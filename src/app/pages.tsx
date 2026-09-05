import { Link } from 'react-router'
import { useMe, useSessionState } from '~/features/auth/session-hooks'
import { Card, EmptyState } from '~/shared/ui'

export function HomePage() {
  const { signedIn } = useSessionState()
  const { data: me } = useMe()

  return (
    <div className="space-y-6">
      <h1 className="text-display">Event Ticket</h1>
      {signedIn && me ? (
        <Card>
          <p className="text-body">
            Signed in as <strong className="text-body-strong">{me.displayName}</strong> ({me.email}).
          </p>
          {!me.emailVerified && (
            <p className="mt-4 border-2 border-ink bg-hold px-4 py-3 text-body text-ink">
              Your email is not confirmed yet, so you cannot buy tickets.
            </p>
          )}
        </Card>
      ) : (
        <p className="text-body">
          <Link className="underline underline-offset-4" to="/sign-in">
            Sign in
          </Link>{' '}
          to buy tickets or manage events.
        </p>
      )}
    </div>
  )
}

/**
 * A route that exists and says what will be here. During development this beats a 404,
 * which is indistinguishable from a routing bug.
 */
export function PlaceholderPage({ what, slice }: { what: string; slice: string }) {
  return (
    <div className="border-2 border-dashed border-ink-soft bg-paper p-8">
      <h1 className="text-heading text-ink">{what}</h1>
      <p className="mt-2 text-body text-ink-soft">Arrives in slice {slice}.</p>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto mt-16 max-w-[640px] px-4">
      <EmptyState
        headline="Not found"
        action={
          <Link className="underline underline-offset-4" to="/">
            Back to the start
          </Link>
        }
      >
        There is nothing at this address.
      </EmptyState>
    </div>
  )
}
