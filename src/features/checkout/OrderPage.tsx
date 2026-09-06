import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { Order } from '~/api/types'
import { formatMoney } from '~/shared/format'
import { Button, Card, MoneyTotal, Problem, StatusChip } from '~/shared/ui'
import { HoldCountdown } from './HoldCountdown'
import { NextAction } from './NextAction'
import { useAbandonOrder, useOrder, useStartPayment } from './order-hooks'

export function OrderPage() {
  const { orderId = '' } = useParams()
  const order = useOrder(orderId)

  if (order.isLoading) {
    return <p className="text-body text-ink-soft">Loading…</p>
  }
  if (order.error || !order.data) {
    return <Problem error={order.error ?? new Error('That order is not here.')} />
  }

  const paid = order.data.status === 'PAID'
  const awaiting = order.data.status === 'AWAITING_PAYMENT'

  return (
    <div className="space-y-6">
      {awaiting && order.data.holdExpiresAt && (
        <div className="-mx-4 sm:mx-0">
          <HoldCountdown expiresAt={order.data.holdExpiresAt} />
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-title">{order.data.eventTitle ?? 'Your order'}</h1>
        <StatusChip status={order.data.status} />
      </div>

      <Summary order={order.data} />

      {paid ? (
        <Card>
          <p className="text-body-strong">Paid. Your tickets are ready.</p>
          <p className="mt-2 max-w-[68ch] text-body text-ink-soft">
            We have emailed you a link to them as well.
          </p>
          <Link
            to={`/orders/${orderId}/tickets`}
            className="mt-4 inline-flex min-h-11 items-center justify-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost"
          >
            See your tickets
          </Link>
        </Card>
      ) : awaiting ? (
        <Pay orderId={orderId} expired={isExpired(order.data)} />
      ) : (
        <Card>
          <p className="max-w-[68ch] text-body">
            {order.data.status === 'EXPIRED'
              ? 'The seats were not paid for in time and have gone back on sale.'
              : order.data.status === 'CANCELLED'
                ? 'This order was abandoned and its seats released.'
                : 'This order has been refunded.'}
          </p>
        </Card>
      )}
    </div>
  )
}

function isExpired(order: Order): boolean {
  return order.holdExpiresAt != null && new Date(order.holdExpiresAt).getTime() <= Date.now()
}

function Summary({ order }: { order: Order }) {
  return (
    <Card>
      <ul className="divide-y-2 divide-ink">
        {(order.seats ?? []).map((seat) => (
          <li key={seat.seatId} className="flex items-baseline justify-between gap-4 py-3 first:pt-0">
            <span className="text-body">
              <span className="font-numeric text-numeric">{seat.label}</span>
              <span className="ml-3 text-ink-soft">{seat.tierName}</span>
            </span>
            {seat.price && (
              <span className="font-numeric text-numeric">{formatMoney(seat.price)}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between gap-4 border-t-2 border-ink pt-4">
        <span className="text-label uppercase">Total</span>
        {/* The largest thing on a screen where money moves (DESIGN.md). */}
        <MoneyTotal money={order.total} />
      </div>
    </Card>
  )
}

/**
 * Paying, and the two things that make this page unusual.
 *
 * The buyer never tells us the payment worked - requirements/005 criterion 3 - so this page
 * waits to be told by the provider, and `useOrder` polls until it is. And when the hold runs
 * out the page says so rather than letting somebody pay for seats that have gone (criterion
 * 9), which is why the expired case replaces the payment controls rather than sitting above
 * them.
 */
function Pay({ orderId, expired }: { orderId: string; expired: boolean }) {
  const navigate = useNavigate()
  const startPayment = useStartPayment(orderId)
  const abandon = useAbandonOrder()
  const [confirmingAbandon, setConfirmingAbandon] = useState(false)

  if (expired) {
    return (
      <Card>
        <p className="text-body-strong">These seats have gone back on sale.</p>
        <p className="mt-2 max-w-[68ch] text-body text-ink-soft">
          The ten minutes ran out before the payment arrived. Nothing has been charged.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex min-h-11 items-center justify-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost"
        >
          Find another event
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Problem error={startPayment.error ?? abandon.error} />

      {startPayment.data ? (
        <>
          <NextAction action={startPayment.data.nextAction} />
          <Button
            variant="ghost"
            className="w-auto px-0"
            pending={startPayment.isPending}
            onClick={() => startPayment.mutate('FAKE')}
          >
            Start again with a different payment
          </Button>
        </>
      ) : (
        <Card>
          <p className="max-w-[68ch] text-body">
            Pay by bank transfer. We will show you a QR code to scan.
          </p>
          <Button
            className="mt-4 w-auto"
            pending={startPayment.isPending}
            onClick={() => startPayment.mutate('FAKE')}
          >
            Pay now
          </Button>
        </Card>
      )}

      {/* Criterion 11: abandoning releases the holds at once, rather than leaving the seats
          dark for the rest of the ten minutes. */}
      {confirmingAbandon ? (
        <Card>
          <p className="text-body">
            Give up these seats? They go back on sale immediately and somebody else may take
            them.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <Button
              variant="ghost"
              className="w-auto"
              onClick={() => setConfirmingAbandon(false)}
            >
              Keep them
            </Button>
            <Button
              variant="destructive"
              className="w-auto"
              pending={abandon.isPending}
              onClick={() =>
                abandon.mutate(orderId, { onSuccess: () => void navigate('/', { replace: true }) })
              }
            >
              Release the seats
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="ghost" className="w-auto px-0" onClick={() => setConfirmingAbandon(true)}>
          Give up these seats
        </Button>
      )}
    </div>
  )
}
