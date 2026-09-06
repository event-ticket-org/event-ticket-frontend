import { useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Order, Refund } from '~/api/types'
import { useEvent } from '~/features/events/event-hooks'
import { formatMoney } from '~/shared/format'
import {
  Button,
  Card,
  EmptyState,
  Problem,
  Segment,
  Segmented,
  StatusChip,
  inputClass,
} from '~/shared/ui'
import { useEventOrders, useOrderRefunds, useRefundOrder, type OrderFilter } from './refund-hooks'

/**
 * What an Event sold, and the one thing an organizer can do about it.
 *
 * A page of its own rather than another card on the Event: this is a list somebody works
 * through, and the Event page is a form somebody edits. They are different tasks with
 * different shapes, and the Event page is long enough already.
 */
const FILTERS: { label: string; filter: OrderFilter }[] = [
  { label: 'All', filter: {} },
  // First after All, because it is the one with money in it that should not be there.
  { label: 'Needs refunding', filter: { refundRequired: true } },
  { label: 'Paid', filter: { status: 'PAID' } },
  { label: 'Refunded', filter: { status: 'REFUNDED' } },
]

export function EventOrdersPage() {
  const { eventId = '' } = useParams()
  const event = useEvent(eventId)
  const [chosen, setChosen] = useState(0)
  const orders = useEventOrders(eventId, FILTERS[chosen]!.filter)
  const refund = useRefundOrder()

  const rows = orders.data?.pages.flatMap((page) => page.items ?? []) ?? []
  const owed = event.data?.refundRequiredCount ?? 0

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/manage/events/${eventId}`}
          className="text-label uppercase underline underline-offset-4"
        >
          {event.data?.title ?? 'Event'}
        </Link>
        <h1 className="mt-2 text-title">Orders</h1>
      </div>

      {owed > 0 && (
        // Money taken for seats that were never delivered. It has a home on this page rather
        // than a notification somewhere else, because this is the page that can act on it.
        <div className="border-2 border-ink bg-hold px-4 py-3 text-ink">
          <p className="text-body-strong">
            {owed === 1
              ? 'One order is holding money for seats it never got.'
              : `${owed} orders are holding money for seats they never got.`}
          </p>
          {/*
            No longer names a cause. There are two ways into this state - a payment that landed
            after the holds lapsed, and a refund the provider reported settled and then reversed
            - and this banner asserted the first, which was simply wrong for an Order that got
            here the other way. Each row below says which, and says it with the provider's own
            words.
          */}
          <p className="mt-1 max-w-[68ch] text-body">
            Nothing about it is the buyer&rsquo;s fault, and refunding is the way out. Each
            order says how it got here.
          </p>
        </div>
      )}

      <Segmented label="Filter orders">
        {FILTERS.map((option, index) => (
          <Segment key={option.label} selected={chosen === index} onClick={() => setChosen(index)}>
            {option.label}
          </Segment>
        ))}
      </Segmented>

      <Problem error={orders.error ?? refund.error} />

      {orders.isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState headline="Nothing here">
          {chosen === 0
            ? 'This event has not sold anything yet.'
            : 'No order on this event matches that.'}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {rows.map((order) => (
            <li key={order.id}>
              <OrderRow
                order={order}
                pending={refund.isPending}
                onRefund={(reason) =>
                  refund.mutateAsync({ orderId: order.id, reason })
                }
              />
            </li>
          ))}
        </ul>
      )}

      {orders.hasNextPage && (
        <Button
          variant="secondary"
          className="w-auto"
          pending={orders.isFetchingNextPage}
          onClick={() => void orders.fetchNextPage()}
        >
          Load more
        </Button>
      )}
    </div>
  )
}

function OrderRow({
  order,
  pending,
  onRefund,
}: {
  order: Order
  pending: boolean
  onRefund: (reason: string) => Promise<unknown>
}) {
  const [refunding, setRefunding] = useState(false)
  const [reason, setReason] = useState('')

  // Asked for every Order that has money in it, which is a request per such row. The
  // alternative was asking only for Orders already refunded, and it was wrong in the way that
  // matters: an Order with a refund still with the provider looked untouched, offered the
  // button again, and the second attempt is refused. Orders with nothing to refund - expired
  // unpaid, abandoned - are still skipped, and the answers cache.
  //
  // The honest fix is refund state on the Order in the contract. That is a knowledge base
  // change, and this list is read by one person at a time.
  const hasMoney = order.status === 'PAID' || order.refundRequired === true
  // REFUNDED used to be the end of the story. A provider that takes a settlement back
  // (requirements/008 criterion 11) leaves an Order reading REFUNDED and holding the money
  // again - so what closes this row is not the status, it is whether anything is still owed.
  // Reading the status alone put a flag on the row and no way to act on it.
  const settled = order.status === 'REFUNDED' && order.refundRequired !== true
  const history = useOrderRefunds(order.id, hasMoney || settled)
  const refunds = history.data ?? []

  const inFlight = refunds.some((attempt) => attempt.status === 'REFUND_PENDING')

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-body-strong">{order.buyerEmail ?? 'Somebody'}</p>
          <p className="mt-1 text-body text-ink-soft">
            {(order.seats ?? []).map((seat) => seat.label).join(', ') || 'No seats'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-numeric text-numeric">{formatMoney(order.total)}</span>
          <StatusChip status={order.status} />
          {order.refundRequired && (
            // Not a StatusChip: this is not the Order's status, it is a fact about the money
            // sitting inside one that reads as PAID or EXPIRED.
            <span className="border-2 border-ink bg-hold px-2 py-1 text-label uppercase text-ink">
              Owes a refund
            </span>
          )}
        </div>
      </div>

      <RefundHistory refunds={refunds} />

      {hasMoney && !settled && !inFlight && (
        <div className="mt-4">
          {refunding ? (
            <div className="space-y-3">
              <label className="block text-label uppercase" htmlFor={`reason-${order.id}`}>
                Why, in one sentence
              </label>
              {/* Required by the contract, and for a reason: the buyer is sent this, and
                  "your order was refunded" with no cause generates the support request it
                  was meant to replace. */}
              <input
                id={`reason-${order.id}`}
                className={inputClass}
                value={reason}
                maxLength={500}
                onChange={(change) => setReason(change.target.value)}
                autoFocus
              />
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="ghost"
                  className="w-auto"
                  onClick={() => {
                    setRefunding(false)
                    setReason('')
                  }}
                >
                  Keep the money
                </Button>
                <Button
                  variant="destructive"
                  className="w-auto"
                  pending={pending}
                  disabled={reason.trim() === ''}
                  onClick={() => void onRefund(reason.trim()).then(() => setRefunding(false))}
                >
                  Refund {formatMoney(order.total)}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="w-auto px-0" onClick={() => setRefunding(true)}>
              Refund this order
            </Button>
          )}
        </div>
      )}

      {inFlight && (
        <p className="mt-4 text-body text-ink-soft">
          A refund has been asked for and the provider has not answered yet. The tickets on this
          order already admit nobody.
        </p>
      )}
    </Card>
  )
}

/**
 * Every attempt, not only the last.
 *
 * A refused refund is kept with its reason, and the row above it may be a second attempt that
 * worked - which is the only way to tell "we tried and the bank refused" from "nobody has
 * tried". Collapsing to a single status would lose exactly that.
 */
function RefundHistory({ refunds }: { refunds: Refund[] }) {
  if (refunds.length === 0) {
    return null
  }
  return (
    <ul className="mt-4 space-y-2 border-t-2 border-ink pt-4">
      {refunds.map((attempt) => (
        <li key={attempt.id}>
          <div className="flex flex-wrap items-baseline gap-3">
            <StatusChip status={attempt.status} />
            <span className="text-body">{attempt.reason}</span>
          </div>
          {/* On its own line and attributed. Run together with the reason above, the two read
              as one sentence - and they have different authors: we wrote the first and the
              provider wrote the second. */}
          {attempt.failureReason && (
            <p className="mt-1 text-body">
              <span className="text-label uppercase">The provider said</span>{' '}
              {attempt.failureReason}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
