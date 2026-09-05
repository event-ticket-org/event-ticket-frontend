import { Link } from 'react-router'
import { useMe, useSessionState } from '~/features/auth/session-hooks'

export function HomePage() {
  const { signedIn } = useSessionState()
  const { data: me } = useMe()

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Event Ticket</h1>
      {signedIn && me ? (
        <p className="text-slate-600">
          Signed in as <strong>{me.displayName}</strong> ({me.email}).
          {!me.emailVerified && ' Your email is not confirmed yet, so you cannot buy tickets.'}
        </p>
      ) : (
        <p className="text-slate-600">
          <Link className="underline" to="/sign-in">Sign in</Link> to buy tickets or manage
          events.
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
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
      <h1 className="text-lg font-medium text-slate-900">{what}</h1>
      <p className="mt-1 text-sm text-slate-500">Arrives in slice {slice}.</p>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-slate-600">
        <Link className="underline" to="/">Back to the start</Link>
      </p>
    </div>
  )
}
