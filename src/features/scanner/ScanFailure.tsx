import { ApiError } from '~/api/errors'
import { ScannerButton } from './scanner-ui'

/**
 * A scan that never got an answer.
 *
 * requirements/007 criterion 11: losing connectivity shows an explicit failure, and the
 * scanner never admits optimistically. So this borrows the shape of neither verdict - not the
 * `go` field, not the `stop` field, not the word - because at arm's length, in the dark, a
 * screen that looks like a refusal is a refusal, and nobody has been refused here. Nobody has
 * been anything: the person is still standing at the door waiting to be told.
 */
export function ScanFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <section role="alert" className="fixed inset-0 z-50 flex flex-col bg-night text-chalk">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-verdict text-hold">FAILED</p>
        <p className="text-body">{messageFor(error)}</p>
      </div>
      <div className="px-4 pb-4">
        <ScannerButton onClick={onRetry}>Try again</ScannerButton>
      </div>
    </section>
  )
}

/**
 * A scan that is still in the air.
 *
 * Under `nfr.md`'s 500 ms this is a flicker nobody reads, which is the point: the operator
 * only ever sees it when something has gone slow, and then it is the difference between a
 * scanner that is working and a scanner that ignored them. Without it the phone shows the
 * camera and the last screen while a request hangs, and the operator scans again.
 */
export function ScanWorking() {
  return (
    <section role="status" className="fixed inset-0 z-50 flex flex-col bg-night text-chalk">
      <div className="flex flex-1 items-center justify-center px-4 text-center">
        {/* A word, not a spinner, and deliberately smaller than a verdict: this is the one
            screen in the scanner that must never be mistaken for an answer. */}
        <p className="text-title">Checking…</p>
      </div>
    </section>
  )
}

/**
 * The backend's own words wherever there are any, which is everywhere except the rate limit:
 * the contract gives 429 a description and no body, so there is no `code` to branch on and no
 * message to show. That one case is the reason this branches on a status at all.
 */
function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'Too many scans from this device in a row. Wait a few seconds and scan again.'
  }
  return error instanceof Error ? error.message : 'The scan did not reach the server.'
}
