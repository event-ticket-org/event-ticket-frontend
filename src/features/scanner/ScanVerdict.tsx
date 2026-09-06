import { useEffect } from 'react'
import type { ScanResult } from '~/api/types'
import { formatTimeInZone } from '~/shared/format'
import { cx } from '~/shared/ui'
import { verdictOf, vibrationFor, wordFor } from './scan-outcomes'
import { ScannerButton } from './scanner-ui'
import { useVerdictHold } from './verdict-hold'

/**
 * The component the whole scanner shell exists to render.
 *
 * Full bleed, one word, and three independent signals for it: the word, the mark, and - for a
 * refusal only - a frame inside the edge of the screen. An operator who cannot tell
 * `{colors.go}` from `{colors.stop}` reads any one of the three, which is the reason the
 * refusal carries a shape the admission does not.
 */
export function ScanVerdict({
  result,
  eventTitle,
  timeZone,
  onDismiss,
}: {
  result: ScanResult
  eventTitle: string
  timeZone: string
  onDismiss: () => void
}) {
  const verdict = verdictOf(result.outcome)
  const admitted = verdict === 'ADMIT'
  const { remaining, dismiss } = useVerdictHold(result, onDismiss)

  // The only channel that works when the phone is not being looked at, which is most of the
  // time: it is held out while the operator looks at the person. Absent on iOS Safari, so the
  // screen and the sound of the queue are all there is there.
  useEffect(() => {
    navigator.vibrate?.(vibrationFor(verdict))
  }, [result, verdict])

  return (
    <section
      role="alert"
      className={cx(
        'fixed inset-0 z-50 flex flex-col text-ink',
        admitted ? 'bg-go' : 'bg-stop',
      )}
    >
      {/* The shape difference that carries the meaning when colour does not. Inside the edge
          rather than on it, so it survives a phone case and a rounded display cutout. */}
      {!admitted && (
        <div className="pointer-events-none absolute inset-3 border-[3px] border-ink" />
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <Mark admitted={admitted} />
        <p className="text-verdict">{wordFor(verdict)}</p>
        {result.seatLabel && <p className="font-numeric text-numeric-lg">{result.seatLabel}</p>}
        <p className="text-heading">{eventTitle}</p>
      </div>

      {/* The bottom third: what the server said, and the one control. */}
      <div className="space-y-3 px-4 pb-4">
        {/* Verbatim. The backend writes these to be read by the person at the door, and
            rewriting them here would only let the two drift. */}
        <p className="text-body">{result.message}</p>

        <FirstRedemption result={result} timeZone={timeZone} />

        {/* Last, because it is the least of the three. On an admission it says which part of
            the room to point at; on a refusal it is only ever context. */}
        {result.tierName && <p className="text-body">{result.tierName}</p>}

        {/* The scanner's one control, unchanged on the verdict field: night-raised and chalk
            read on go and on stop, and an operator should not have to learn a second button
            in the dark. */}
        <ScannerButton onClick={dismiss}>
          {remaining > 0 ? `Scan next in ${remaining}` : 'Scan next'}
        </ScannerButton>
      </div>
    </section>
  )
}

/**
 * requirements/007 criterion 5, which is the only place in the scanner where a second line of
 * detail earns its space: when and at which device it was first used is the difference between
 * telling somebody they have already been in and telling them somebody else used their ticket.
 *
 * The Venue's clock, never the phone's (`nfr.md`) - a device set to the wrong zone would
 * otherwise make a redemption four minutes ago look like one from this morning.
 */
function FirstRedemption({ result, timeZone }: { result: ScanResult; timeZone: string }) {
  if (result.outcome !== 'ALREADY_REDEEMED' || !result.firstRedeemedAt) {
    return null
  }
  return (
    <p className="text-body">
      First used at{' '}
      <span className="font-numeric">{formatTimeInZone(result.firstRedeemedAt, timeZone)}</span>
      {result.firstRedeemedDeviceId && <> on {result.firstRedeemedDeviceId}</>}
    </p>
  )
}

/**
 * A 12px stroke at 96px square, drawn rather than set: no icon set is chosen for this project,
 * and two paths are cheaper than adopting one for them.
 */
function Mark({ admitted }: { admitted: boolean }) {
  return (
    <svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
      <path
        d={admitted ? 'M16 50 L38 72 L80 26' : 'M22 22 L74 74 M74 22 L22 74'}
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="square"
      />
    </svg>
  )
}
