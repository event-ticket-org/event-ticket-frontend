import { Link } from 'react-router'
import { formatMoney } from '~/shared/format'
import { Button, EmptyState, Problem, StatusChip, cx } from '~/shared/ui'
import { useOrders } from '~/features/checkout/order-hooks'

/**
 * Every Order this buyer has, wherever it was bought.
 *
 * requirements/006 criterion 5: in one place, across Organizations. A buyer does not think in
 * tenants - they think in "the thing I bought" - and splitting this by whoever sold it would
 * be the system's own structure showing through.
 */
export function OrdersPage() {
  const orders = useOrders()
  const rows = orders.data?.pages.flatMap((page) => page.items ?? []) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-title">My tickets</h1>

      <Problem error={orders.error} />

      {orders.isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          headline="Nothing bought yet"
          action={
            <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost"
            >
              See what&rsquo;s on
            </Link>
          }
        >
          Orders appear here as soon as you buy something, with their tickets.
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {rows.map((order) => (
            <li key={order.id}>
              <Link
                to={order.status === 'PAID' ? `/orders/${order.id}/tickets` : `/orders/${order.id}`}
                className={cx(
                  'flex flex-wrap items-baseline justify-between gap-4 border-2 border-ink bg-paper p-6 shadow-raised',
                  'transition-[transform,box-shadow] duration-[60ms] ease-linear',
                  'hover:shadow-hover active:translate-x-1 active:translate-y-1 active:shadow-none',
                  'motion-reduce:transition-none',
                )}
              >
                <div>
                  <h2 className="text-heading">{order.eventTitle ?? 'Order'}</h2>
                  <p className="mt-1 text-body text-ink-soft">
                    {(order.seats ?? []).length}{' '}
                    {(order.seats ?? []).length === 1 ? 'seat' : 'seats'}
                    {order.seats && order.seats.length > 0 && (
                      <> · {order.seats.map((seat) => seat.label).join(', ')}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-numeric text-numeric">{formatMoney(order.total)}</span>
                  <StatusChip status={order.status} />
                </div>
              </Link>
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
          Older orders
        </Button>
      )}
    </div>
  )
}
