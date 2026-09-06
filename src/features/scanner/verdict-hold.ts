import { useEffect, useRef, useState } from 'react'
import { VERDICT_HOLD_MS } from './scan-outcomes'

/**
 * The hold: until the operator dismisses it, or four seconds, whichever is later.
 *
 * It never advances on its own. A verdict that clears itself is a verdict somebody did not
 * read, and the thing that makes an operator tap through a screen without reading it is
 * precisely the queue they are always standing in front of - so a tap inside the four seconds
 * is remembered and acted on when they are up, rather than obeyed at once or thrown away.
 *
 * `key` restarts the hold. It is the verdict object, so a new answer restarts the four seconds
 * and the same answer re-rendered does not.
 */
export function useVerdictHold(key: unknown, onDismiss: () => void) {
  const [remaining, setRemaining] = useState(() => Math.ceil(VERDICT_HOLD_MS / 1000))
  const queued = useRef(false)

  // Held in a ref rather than depended on. The page rebuilds this callback on every render -
  // it closes over a mutation object that is new each time - and a dependency on it would
  // restart the four seconds on every render, so the hold would never end and the scanner
  // would stop after one person.
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    queued.current = false
    const startedAt = Date.now()
    setRemaining(Math.ceil(VERDICT_HOLD_MS / 1000))

    const tick = setInterval(() => {
      const left = VERDICT_HOLD_MS - (Date.now() - startedAt)
      setRemaining(Math.max(0, Math.ceil(left / 1000)))
      if (left <= 0) {
        clearInterval(tick)
        if (queued.current) {
          dismissRef.current()
        }
      }
    }, 250)

    return () => clearInterval(tick)
  }, [key])

  const dismiss = () => {
    if (remaining > 0) {
      queued.current = true
    } else {
      dismissRef.current()
    }
  }

  return { remaining, dismiss }
}
