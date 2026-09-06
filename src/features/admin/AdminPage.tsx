import { useState } from 'react'
import type { Organization, OrganizationStatus } from '~/api/types'
import {
  Button,
  EmptyState,
  Problem,
  Segment,
  Segmented,
  StatusChip,
  TimeWithZone,
  cx,
  inputClass,
} from '~/shared/ui'
import { useDecideOrganization, useOrganizations } from './admin-hooks'

const QUEUES: { status: OrganizationStatus; label: string }[] = [
  { status: 'PENDING_APPROVAL', label: 'Waiting' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Rejected' },
]

/**
 * The approval queue. Until an Organization is approved it cannot publish anything, so this
 * screen is the gate every organizer waits behind.
 *
 * Dense on purpose: this is the manager shell's audience - a desk, a mouse, a list worked
 * through in one sitting - and rows are separated by rules rather than by whitespace.
 */
export function AdminPage() {
  const [queue, setQueue] = useState<OrganizationStatus>('PENDING_APPROVAL')
  const organizations = useOrganizations(queue)
  const decide = useDecideOrganization()

  const rows = organizations.data?.pages.flatMap((page) => page.items ?? []) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-title">Organizations</h1>
        <Segmented label="Filter organizations by status">
          {QUEUES.map((option) => (
            <Segment
              key={option.status}
              selected={queue === option.status}
              onClick={() => setQueue(option.status)}
            >
              {option.label}
            </Segment>
          ))}
        </Segmented>
      </div>

      <Problem error={organizations.error ?? decide.error} />

      {organizations.isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState headline="Nothing here">
          {queue === 'PENDING_APPROVAL'
            ? 'No organization is waiting for a decision.'
            : 'No organization has that status.'}
        </EmptyState>
      ) : (
        <>
          {/*
            Two renderings of one list, and never both at once - DESIGN.md: below `md` a table
            becomes stacked cards. CSS rather than a viewport hook, which is how the seat map
            editor hides itself on a phone; `hidden` is `display: none`, so the one that is not
            showing is out of the accessibility tree rather than read twice.

            Not a horizontal scroller, which is what this was. A table you have to drag
            sideways to reach the button in its last column is a table nobody can use one-handed
            - and the last column here is the entire point of the screen.
          */}
          <div className="hidden md:block">
            <table className="w-full border-2 border-ink bg-paper text-left">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="px-4 py-3 text-label uppercase">Name</th>
                  <th className="px-4 py-3 text-label uppercase">Created</th>
                  <th className="px-4 py-3 text-label uppercase">Status</th>
                  <th className="px-4 py-3 text-label uppercase">
                    <span className="sr-only">Decision</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((organization, index) => (
                  <Row
                    key={organization.id}
                    organization={organization}
                    striped={index % 2 === 1}
                    pending={decide.isPending}
                    onDecide={(decision, reason) =>
                      decide.mutate({ id: organization.id, decision, reason })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-4 md:hidden">
            {rows.map((organization) => (
              <li key={organization.id}>
                <Card
                  organization={organization}
                  pending={decide.isPending}
                  onDecide={(decision, reason) =>
                    decide.mutate({ id: organization.id, decision, reason })
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {organizations.hasNextPage && (
        <Button
          variant="secondary"
          className="w-auto"
          pending={organizations.isFetchingNextPage}
          onClick={() => void organizations.fetchNextPage()}
        >
          Load more
        </Button>
      )}
    </div>
  )
}

/**
 * When an Organization asked, in the one timezone this platform operates in.
 *
 * No Venue here and so no venue timezone: this is a platform-wide screen rather than an event.
 * It still says which zone, because a bare clock face never ships.
 */
function Asked({ organization }: { organization: Organization }) {
  return organization.createdAt ? (
    <TimeWithZone iso={organization.createdAt} timeZone="Asia/Ho_Chi_Minh" />
  ) : (
    <span className="text-body text-ink-soft">—</span>
  )
}

function Row({
  organization,
  striped,
  pending,
  onDecide,
}: {
  organization: Organization
  striped: boolean
  pending: boolean
  onDecide: (decision: 'APPROVED' | 'REJECTED', reason?: string) => void
}) {
  return (
    <tr className={cx('border-b border-ink last:border-b-0', striped && 'bg-paper-sunk')}>
      <td className="px-4 py-3 align-top text-body-strong">{organization.name}</td>
      <td className="px-4 py-3 align-top">
        <Asked organization={organization} />
      </td>
      <td className="px-4 py-3 align-top">
        <StatusChip status={organization.status} />
      </td>
      <td className="px-4 py-3 align-top">
        <Decision organization={organization} pending={pending} onDecide={onDecide} align="end" />
      </td>
    </tr>
  )
}

/**
 * The same row as a card, for below `md`.
 *
 * Field names above their values rather than in a header row somewhere off-screen, because a
 * column heading a phone cannot show is a label that is not there. The name leads, since it is
 * what somebody is looking for; the decision is last, where a thumb is.
 */
function Card({
  organization,
  pending,
  onDecide,
}: {
  organization: Organization
  pending: boolean
  onDecide: (decision: 'APPROVED' | 'REJECTED', reason?: string) => void
}) {
  return (
    <div className="space-y-3 border-2 border-ink bg-paper p-4">
      <div>
        <div className="text-label uppercase">Name</div>
        <div className="text-body-strong">{organization.name}</div>
      </div>
      <div>
        <div className="text-label uppercase">Created</div>
        <Asked organization={organization} />
      </div>
      <div>
        <div className="text-label uppercase">Status</div>
        <StatusChip status={organization.status} />
      </div>
      <Decision organization={organization} pending={pending} onDecide={onDecide} align="start" />
    </div>
  )
}

/**
 * Approve or reject, wherever the row is being drawn.
 *
 * One component rather than two copies of a two-step flow with a text field in the middle of
 * it. `align` is the only thing the two callers disagree about: buttons sit at the right of a
 * dense table row and at the left of a card, where the eye is already reading from.
 */
function Decision({
  organization,
  pending,
  onDecide,
  align,
}: {
  organization: Organization
  pending: boolean
  onDecide: (decision: 'APPROVED' | 'REJECTED', reason?: string) => void
  align: 'start' | 'end'
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const waiting = organization.status === 'PENDING_APPROVAL'

  return (
    <>
      {waiting &&
        (rejecting ? (
          // Rejecting emails the Owner and is not something to do by a stray click, so it
          // costs a second step and carries the reason the contract already accepts. The
          // reason is the difference between a decision somebody can act on and a dead end.
          <div className={cx('flex flex-col gap-3', align === 'end' ? 'items-end' : 'items-start')}>
            <input
              className={cx(inputClass, 'w-full max-w-96')}
              placeholder="Why, in one sentence"
              value={reason}
              onChange={(change) => setReason(change.target.value)}
              maxLength={1000}
              autoFocus
            />
            <div className="flex flex-wrap gap-3">
              <Button
                variant="ghost"
                className="w-auto"
                onClick={() => {
                  setRejecting(false)
                  setReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="w-auto"
                disabled={pending || reason.trim().length === 0}
                onClick={() => onDecide('REJECTED', reason.trim())}
              >
                Reject
              </Button>
            </div>
          </div>
        ) : (
          // Approving is the common, safe and reversible-by-re-approval outcome, so it is
          // the loud one. Rejecting is quiet and takes two steps: DESIGN.md asks for the
          // destructive path to be the harder one, and equal buttons make it the opposite.
          <div
            className={cx(
              'flex flex-wrap gap-3',
              align === 'end' ? 'justify-end' : 'justify-start',
            )}
          >
            <Button className="w-auto" disabled={pending} onClick={() => onDecide('APPROVED')}>
              Approve
            </Button>
            <Button
              variant="ghost"
              className="w-auto"
              disabled={pending}
              onClick={() => setRejecting(true)}
            >
              Reject
            </Button>
          </div>
        ))}
    </>
  )
}
