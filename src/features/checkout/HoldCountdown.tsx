import { useEffect, useState } from 'react'
import { remainingUntil } from '~/shared/format'
import { cx } from '~/shared/ui'

/**
 * The clock on a Seat Hold, as a bar rather than a widget.
 *
 * requirements/004 criterion 8: the buyer sees the remaining hold time throughout checkout.
 * DESIGN.md makes it full width and pinned, because a countdown somebody has to go looking
 * for is one they will discover at zero.
 *
 * The digits are tabular. In a proportional face the glyphs have different widths, so the
 * number reflows on every tick and visibly jitters - and a timer that jitters reads as
 * untrustworthy at exactly the moment a buyer needs to trust it.
 */
export function HoldCountdown({
  expiresAt,
  onExpired,
}: {
  expiresAt: string
  onExpired?: () => void
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  const left = remainingUntil(expiresAt, now)
  const secondsLeft = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))

  // Told once, on the tick that crosses zero. The page above decides what to do about it;
  // criterion 9 is that a buyer is told clearly rather than failing later at payment.
  useEffect(() => {
    if (left === null) {
      onExpired?.()
    }
  }, [left, onExpired])

  if (left === null) {
    return (
      <div className="sticky top-0 z-10 border-b-2 border-ink bg-stop px-4 py-3 text-ink">
        <p className="text-body-strong">Your seats have been released.</p>
      </div>
    )
  }

  return (
    <div
      className={cx(
        'sticky top-0 z-10 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink px-4 py-3 text-ink',
        secondsLeft <= 30 ? 'bg-stop' : secondsLeft <= 120 ? 'bg-hold' : 'bg-paper',
      )}
    >
      <p className="text-label uppercase">Seats held for</p>
      <p className="font-numeric text-numeric-lg" aria-live="off">
        {left}
      </p>
      <p className="text-body">
        {secondsLeft <= 120
          ? 'Finish paying, or the seats go back on sale.'
          : 'Time to pay before the seats go back on sale.'}
      </p>
    </div>
  )
}
