import { useState } from 'react'
import type { Membership, Role } from '~/api/types'
import { useActiveMembership, useMe } from '~/features/auth/session-hooks'
import { Button, Card, EmptyState, Field, Problem, cx, inputClass } from '~/shared/ui'
import { ROLES, roleLabel } from './roles'
import {
  useChangeMemberRole,
  useInviteMember,
  useMembers,
  useRemoveMember,
} from './member-hooks'

/**
 * Who is on the team, and what each of them can reach.
 *
 * requirements/001 criteria 7 to 10. The Organization is the one in the token and never a
 * parameter, so this screen acts on whichever Organization the header says is active - which
 * is the reason the header now says the true one rather than the first in the list.
 *
 * Everything here is Owner-only on the server (`Owners.requireCallerIsOwner`). A Manager or
 * Gate Staff still sees the list, because knowing who else has the keys is not a privilege,
 * and offering them controls that will be refused would be a lie told in advance.
 */
export function TeamPage() {
  const members = useMembers()
  const { data: me } = useMe()
  const { membership: mine } = useActiveMembership()

  const invite = useInviteMember()
  const changeRole = useChangeMemberRole()
  const remove = useRemoveMember()

  const isOwner = mine?.role === 'OWNER'

  // Owned here rather than inside the form, so that removing the person it names takes it
  // down with them. A banner reading "spare@… is on the team" above a list they are no longer
  // in is a small lie, and it is on the screen whose whole job is saying who has access.
  const [added, setAdded] = useState('')
  const rows = members.data ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-title">Team</h1>
        <p className="mt-2 max-w-[68ch] text-body text-ink-soft">
          {isOwner
            ? 'Everyone with access to ' +
              (mine?.organizationName ?? 'this organization') +
              '. Adding someone sends them an email; their access works as soon as their address is confirmed.'
            : 'Everyone with access to ' +
              (mine?.organizationName ?? 'this organization') +
              '. Only an owner can add, remove or re-role people.'}
        </p>
      </div>

      <Problem error={members.error ?? invite.error ?? changeRole.error ?? remove.error} />

      {isOwner && (
        <InviteForm
          onInvite={invite.mutateAsync}
          pending={invite.isPending}
          added={added}
          onAdded={setAdded}
        />
      )}

      {members.isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState headline="Nobody here yet">
          That should not be possible — an organization keeps at least one owner. Reload, and
          tell us if it persists.
        </EmptyState>
      ) : (
        // A list rather than a table. Three columns, one of them a pair of controls, and a
        // person is not a row of data: this stays one shape from 375px to 1280px instead of
        // becoming a table that has to turn back into cards on a phone.
        <ul className="border-2 border-ink bg-paper">
          {rows.map((member, index) => (
            <li
              key={member.userId}
              className={cx(
                'border-b border-ink px-4 py-4 last:border-b-0',
                index % 2 === 1 && 'bg-paper-sunk',
              )}
            >
              <MemberRow
                member={member}
                isSelf={member.userId === me?.id}
                canManage={isOwner}
                organizationName={mine?.organizationName}
                onChangeRole={(role) => {
                  setAdded('')
                  return changeRole.mutateAsync({ userId: member.userId, role })
                }}
                onRemove={() => {
                  setAdded('')
                  return remove.mutateAsync(member.userId)
                }}
                pending={changeRole.isPending || remove.isPending}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MemberRow({
  member,
  isSelf,
  canManage,
  organizationName,
  onChangeRole,
  onRemove,
  pending,
}: {
  member: Membership
  isSelf: boolean
  canManage: boolean
  organizationName?: string
  onChangeRole: (role: Role) => Promise<unknown>
  onRemove: () => Promise<unknown>
  pending: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [draft, setDraft] = useState<Role>(member.role)

  const who = member.displayName?.trim() || member.email || member.userId

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-body-strong">
            {who}
            {isSelf && <span className="ml-2 text-label uppercase text-ink-soft">You</span>}
          </p>
          {member.email && member.email !== who && (
            <p className="text-body text-ink-soft">{member.email}</p>
          )}
        </div>

        <div className="flex flex-wrap items-baseline gap-4">
          {/* Plain type, not a chip. DESIGN.md keeps the state colours for state and the tier
              colours for tiers; a role is neither, and colouring it would say something about
              an owner and a volunteer that is not true. */}
          <span className="text-label uppercase">{roleLabel(member.role)}</span>
          {canManage && !editing && !removing && (
            <>
              <Button
                variant="ghost"
                className="w-auto px-0"
                onClick={() => {
                  setDraft(member.role)
                  setEditing(true)
                }}
              >
                Change role
              </Button>
              <Button
                variant="ghost"
                className="w-auto px-0"
                onClick={() => setRemoving(true)}
              >
                Remove
              </Button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <RoleEditor
          value={draft}
          onChange={setDraft}
          pending={pending}
          unchanged={draft === member.role}
          onCancel={() => setEditing(false)}
          onSave={() => void onChangeRole(draft).then(() => setEditing(false))}
        />
      )}

      {removing && (
        <Card className="bg-paper">
          <p className="max-w-[68ch] text-body">
            {isSelf
              ? `Remove yourself from ${organizationName ?? 'this organization'}? You lose access to it, and only another owner can put you back.`
              : `Remove ${who}? They stop being able to scan at the door immediately, and lose everything else within fifteen minutes.`}
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <Button variant="ghost" className="w-auto" onClick={() => setRemoving(false)}>
              Keep them
            </Button>
            <Button
              variant="destructive"
              className="w-auto"
              pending={pending}
              onClick={() => void onRemove().then(() => setRemoving(false))}
            >
              Remove
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

/**
 * A role is changed by choosing and then saving, never by the choosing alone.
 *
 * A `<select>` whose `onChange` performs the action fires on a keyboard arrow press, so
 * somebody moving through the options with the keyboard would make three people owners on the
 * way past. This project has made that mistake once already, in the seat map.
 */
function RoleEditor({
  value,
  onChange,
  onSave,
  onCancel,
  pending,
  unchanged,
}: {
  value: Role
  onChange: (role: Role) => void
  onSave: () => void
  onCancel: () => void
  pending: boolean
  unchanged: boolean
}) {
  return (
    <div className="space-y-3 border-2 border-ink bg-paper p-4">
      <RoleField value={value} onChange={onChange} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" className="w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="w-auto" disabled={unchanged} pending={pending} onClick={onSave}>
          Save role
        </Button>
      </div>
    </div>
  )
}

/** The picker and the consequence of the thing picked, together. */
function RoleField({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <Field label="Role" hint={ROLES.find((known) => known.role === value)?.grants}>
      <select
        className={inputClass}
        value={value}
        onChange={(change) => onChange(change.target.value as Role)}
      >
        {ROLES.map((known) => (
          <option key={known.role} value={known.role}>
            {known.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

function InviteForm({
  onInvite,
  pending,
  added,
  onAdded,
}: {
  onInvite: (input: { email: string; role: Role }) => Promise<unknown>
  pending: boolean
  added: string
  onAdded: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('GATE_STAFF')

  return (
    <Card>
      <h2 className="text-heading">Add someone</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(submit) => {
          submit.preventDefault()
          const address = email.trim()
          void onInvite({ email: address, role }).then(() => {
            onAdded(address)
            setEmail('')
          })
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email address">
            <input
              className={inputClass}
              type="email"
              required
              value={email}
              onChange={(change) => {
                setEmail(change.target.value)
                onAdded('')
              }}
            />
          </Field>
          <RoleField value={role} onChange={setRole} />
        </div>
        <div className="flex justify-end">
          <Button className="w-auto" pending={pending} disabled={email.trim() === ''}>
            Add to the team
          </Button>
        </div>
      </form>
      {added && (
        <p className="mt-4 border-2 border-ink bg-go px-4 py-3 text-body text-ink">
          {added} is on the team. We have emailed them — if they have no account yet, their
          access starts working the moment they confirm that address.
        </p>
      )}
    </Card>
  )
}
