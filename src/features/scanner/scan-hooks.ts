import { useMutation } from '@tanstack/react-query'
import { api } from '~/api/client'
import type { ScanResult } from '~/api/types'

/**
 * How long a scan may take before it stops being a scan.
 *
 * `nfr.md` allows 500 ms from submit to verdict, so ten seconds is not a deadline anybody
 * meets - it is the point past which no answer beats a late one. A connection that has stalled
 * rather than failed will hold a request open for as long as the operating system lets it, and
 * the answer, when it comes, arrives at a screen nobody is looking at any more.
 *
 * The deadline is a race rather than only an abort, because aborting is a request the browser
 * may or may not honour on a connection that has already stalled. Losing the race is what makes
 * it a failure; the abort is what stops us paying for it when the browser obliges.
 */
const SCAN_TIMEOUT_MS = 10_000

/**
 * The message for a scan that ran out of time.
 *
 * It does not say nothing happened, because that is not known: the server may have redeemed the
 * Ticket and lost the answer on the way back. Scanning again is the way to find out, and it is
 * safe - the second scan reports ALREADY_REDEEMED at this device and this minute, which reads
 * as what it is (requirements/007 criterion 5).
 */
const TIMED_OUT =
  'The server did not answer in ten seconds. Scan again - if the first one went through, the ' +
  'next will say so.'

/**
 * Present a Ticket Code at the door.
 *
 * A mutation rather than a query, and deliberately keyless: a query key holding a Ticket Code
 * would put it in the cache, in the devtools and in anything that serialises either. The code
 * travels in the request body and nowhere else (`nfr.md`).
 *
 * **`networkMode: 'always'`**, which is the whole of requirements/007 criterion 11 in one
 * option. TanStack's default is `online`: with the browser reporting no connection it does not
 * fail a mutation, it **pauses** it - `isPending` stays true, the request is never sent, and it
 * runs when the network comes back. At a door that is the worst available behaviour, and it was
 * watched happening: the scanner sat on "Checking…" while an operator waited, and then admitted
 * somebody minutes later, long after they had walked away. Attempting and failing is what lets
 * the scanner say so.
 *
 * **No retry.** TanStack does not retry mutations by default and this must never start: every
 * attempt is recorded (criterion 6), and a silent retry of a request that actually succeeded
 * would answer `ALREADY_REDEEMED` for somebody the server had just let in - turning a good
 * ticket into an argument at the door. A failure is shown and the operator decides.
 *
 * The result is a 200 whatever the outcome, refusals included: a refused Ticket is a
 * successful question, not a failed request. The failures reaching `error` are the ones that
 * are genuinely about the request - no network, no membership, too many scans, no answer.
 */
export function useScan(eventId: string) {
  return useMutation({
    mutationFn: ({ ticketCode, deviceId }: { ticketCode: string; deviceId: string }) =>
      withDeadline(
        api.post<ScanResult>(
          `/events/${eventId}/scans`,
          { ticketCode, deviceId },
          { signal: AbortSignal.timeout(SCAN_TIMEOUT_MS) },
        ),
      ),
    networkMode: 'always',
    retry: false,
  })
}

function withDeadline(answer: Promise<ScanResult>): Promise<ScanResult> {
  let expire: ReturnType<typeof setTimeout>
  const deadline = new Promise<never>((_, reject) => {
    expire = setTimeout(() => reject(new Error(TIMED_OUT)), SCAN_TIMEOUT_MS)
  })
  return Promise.race([answer, deadline]).finally(() => clearTimeout(expire))
}
