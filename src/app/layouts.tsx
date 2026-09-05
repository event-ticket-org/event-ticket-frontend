import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { useMe, useSessionState, useSignOut, useSwitchOrganization } from '~/features/auth/session-hooks'

/**
 * Three shells, one application.
 *
 * requirements/007 puts the scanner in the same application as everything else, with a
 * layout of its own - and the reason is in how it is used: one-handed, in the dark,
 * with a queue waiting. Navigation, breadcrumbs and a header are all things to mis-tap
 * at a gate, so the scanner shell has none of them.
 */

export function PublicLayout() {
  const { signedIn } = useSessionState()
  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold">Event Ticket</Link>
          <div className="flex items-center gap-4 text-sm">
            {signedIn ? (
              <>
                <Link to="/orders" className="underline">My tickets</Link>
                <Link to="/manage" className="underline">Manage</Link>
                <SignOutButton />
              </>
            ) : (
              <Link to="/sign-in" className="underline">Sign in</Link>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export function ManagerLayout() {
  const { data: me, isLoading } = useMe()
  const switchOrganization = useSwitchOrganization()

  if (isLoading) {
    return <p className="p-6 text-slate-600">Loading…</p>
  }
  if (!me?.memberships.length) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold">No organization yet</h1>
        <p className="mt-2 text-slate-600">
          You are not a member of an organization. Create one to start selling tickets, or ask
          an owner to invite you.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/manage" className="font-semibold">Manage</Link>
            <Link to="/manage/venues" className="text-sm underline">Venues</Link>
            <Link to="/manage/events" className="text-sm underline">Events</Link>
          </div>
          {/* Switching reissues the token, because the active Organization is a claim
              inside it and never a parameter on a request (ADR-0004). */}
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={me.memberships.find((m) => m.organizationId)?.organizationId ?? ''}
            onChange={(change) => switchOrganization.mutate({ id: change.target.value })}
          >
            {me.memberships.map((membership) => (
              <option key={membership.organizationId} value={membership.organizationId}>
                {membership.organizationName ?? membership.organizationId}
              </option>
            ))}
          </select>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * No navigation, no header, nothing to mis-tap. Dark because a door at night is dark,
 * and a white screen held up in one is a torch pointed at the person in front of you.
 */
export function ScannerLayout() {
  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <Outlet />
    </div>
  )
}

export function RequireSignedIn() {
  const { signedIn } = useSessionState()
  const location = useLocation()
  if (!signedIn) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

function SignOutButton() {
  const signOut = useSignOut()
  return (
    <button className="underline" onClick={() => signOut.mutate()}>
      Sign out
    </button>
  )
}
