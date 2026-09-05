import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { useMe, useSessionState, useSignOut, useSwitchOrganization } from '~/features/auth/session-hooks'
import { Button, EmptyState } from '~/shared/ui'

/**
 * Three shells, one application.
 *
 * requirements/007 puts the scanner in the same application as everything else, with a
 * layout of its own - and the reason is in how it is used: one-handed, in the dark, with
 * a queue waiting. Navigation, breadcrumbs and a header are all things to mis-tap at a
 * gate, so the scanner shell has none of them.
 *
 * DESIGN.md gives each shell its ground, its width and its touch target minimum, and they
 * differ because the people using them do: an organizer at a desk wants density, a buyer
 * on a phone wants one decision at a time, an operator wants a verdict.
 */

/** One column at every size. The layout at 1280px is the layout at 375px with more margin. */
export function PublicLayout() {
  const { signedIn } = useSessionState()
  const { data: me } = useMe()
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b-2 border-ink bg-paper">
        <nav className="mx-auto flex max-w-[640px] items-center justify-between px-4 py-4">
          <Link to="/" className="text-heading uppercase tracking-tight">
            Event Ticket
          </Link>
          <div className="flex items-center gap-4 text-label uppercase">
            {signedIn ? (
              <>
                <NavLink to="/orders">My tickets</NavLink>
                <NavLink to="/manage">Manage</NavLink>
                {me?.platformAdmin && <NavLink to="/admin">Admin</NavLink>}
                <SignOutButton />
              </>
            ) : (
              <NavLink to="/sign-in">Sign in</NavLink>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-[640px] px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export function ManagerLayout() {
  const { data: me, isLoading } = useMe()
  const switchOrganization = useSwitchOrganization()

  if (isLoading) {
    return <p className="p-8 text-body text-ink-soft">Loading…</p>
  }
  if (!me?.memberships.length) {
    return (
      <ManagerFrame>
        <EmptyState
          headline="No organization yet"
          action={
            <Link
              to="/organizations/new"
              className="inline-flex min-h-11 items-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost"
            >
              Create an organization
            </Link>
          }
        >
          You are not a member of an organization. Create one to start selling tickets, or ask
          an owner to invite you to theirs.
        </EmptyState>
      </ManagerFrame>
    )
  }

  return (
    <ManagerFrame
      nav={
        <>
          <NavLink to="/manage/venues">Venues</NavLink>
          <NavLink to="/manage/events">Events</NavLink>
        </>
      }
      aside={
        // Switching reissues the token, because the active Organization is a claim
        // inside it and never a parameter on a request (ADR-0004).
        <select
          aria-label="Active organization"
          className="min-h-11 border-2 border-ink bg-paper px-3 py-2 text-body text-ink"
          value={me.memberships.find((m) => m.organizationId)?.organizationId ?? ''}
          onChange={(change) => switchOrganization.mutate({ id: change.target.value })}
        >
          {me.memberships.map((membership) => (
            <option key={membership.organizationId} value={membership.organizationId}>
              {membership.organizationName ?? membership.organizationId}
            </option>
          ))}
        </select>
      }
    >
      <Outlet />
    </ManagerFrame>
  )
}

/**
 * Platform administration borrows the manager shell and nothing else. It is deliberately not
 * inside `ManagerLayout`: an administrator acts on Organizations rather than within one, and
 * usually belongs to none, so requiring a Membership would lock them out of their own screen.
 */
export function AdminLayout() {
  return (
    <ManagerFrame home="/admin" title="Platform" nav={<NavLink to="/">Back to the app</NavLink>}>
      <Outlet />
    </ManagerFrame>
  )
}

export function RequirePlatformAdmin() {
  const { data: me, isLoading } = useMe()
  if (isLoading) {
    return <p className="p-8 text-body text-ink-soft">Loading…</p>
  }
  // Read from /me, not from the token's claim: the server is the authority on what a person
  // may do, and `platformAdmin` is optional in the contract, so absent must mean no.
  if (!me?.platformAdmin) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

/**
 * No navigation, no header, nothing to mis-tap. Dark because a door at night is dark, and
 * a white screen held up in one is a torch pointed at the person in front of you.
 *
 * Full bleed at every size: no max width, no page padding, no centred container. When a
 * verdict arrives it covers this entirely, which is the point.
 */
export function ScannerLayout() {
  return (
    <div className="min-h-dvh bg-night text-chalk">
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

/** The manager shell's chrome, shared by the organizer's screens and the platform's. */
function ManagerFrame({
  children,
  nav,
  aside,
  home = '/manage',
  title = 'Manage',
}: {
  children: React.ReactNode
  nav?: React.ReactNode
  aside?: React.ReactNode
  home?: string
  title?: string
}) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b-2 border-ink bg-paper">
        <nav className="mx-auto flex max-w-[1152px] flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-6">
            <Link to={home} className="text-heading uppercase tracking-tight">
              {title}
            </Link>
            {nav}
          </div>
          {aside}
        </nav>
      </header>
      <main className="mx-auto max-w-[1152px] px-4 py-8">{children}</main>
    </div>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-label uppercase underline underline-offset-4">
      {children}
    </Link>
  )
}

function SignOutButton() {
  const signOut = useSignOut()
  return (
    <Button
      variant="ghost"
      className="min-h-11 px-0 text-label uppercase"
      onClick={() => signOut.mutate()}
    >
      Sign out
    </Button>
  )
}
