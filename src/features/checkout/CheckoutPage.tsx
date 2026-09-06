import { useEffect, useRef } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { ApiError } from '~/api/errors'
import { Card, Problem } from '~/shared/ui'
import { useSeatSelection } from '~/features/discovery/seat-selection'
import { useCheckout } from './order-hooks'

/**
 * Where the clock starts.
 *
 * requirements/004: seat selection is free and optimistic, and the commitment begins here -
 * this is the first request that takes anything away from anybody else. It has no interface
 * of its own on the way through, because the buyer already pressed the button that said
 * checkout; if it succeeds they land on their Order, and if it fails they need to know which
 * seats went and get the rest back.
 */
export function CheckoutPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const selection = useSeatSelection(eventId)
  const checkout = useCheckout()

  const started = useRef(false)
  const { mutate } = checkout
  const { selected, clear, dropTaken } = selection

  useEffect(() => {
    // Once. StrictMode runs an effect twice in development, and the second run would take a
    // second set of holds on seats the first run had already taken - from the same buyer,
    // against their own order.
    if (started.current || selected.length === 0) {
      return
    }
    started.current = true

    mutate(
      { eventId, seatIds: selected },
      {
        onSuccess: (order) => {
          // Replaced, not pushed: going back should not start a second checkout.
          void navigate(`/orders/${order.id}`, { replace: true })
          clear()
        },
        onError: (failure) => {
          // Criterion 6: drop exactly the seats somebody else took first and keep the rest,
          // rather than making a buyer rebuild a choice that is still almost entirely valid.
          if (failure instanceof ApiError && failure.seatIds.length > 0) {
            dropTaken(failure.seatIds)
          }
        },
      },
    )
  }, [eventId, selected, mutate, clear, dropTaken, navigate])

  // Only before anything has been attempted. Clearing the selection on success re-renders
  // this component, and a guard that looked only at the selection would fire then - sending
  // the buyer back to the map while their Order sat created and their seats held, with no
  // way to reach either. Two real orders were stranded that way before this said `started`.
  if (!started.current && selected.length === 0) {
    return <Navigate to={`/events/${eventId}`} replace />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-title">Holding your seats</h1>

      {checkout.isPending && (
        <p className="text-body text-ink-soft">Taking the seats off sale for you…</p>
      )}

      {checkout.isError && (
        <Card>
          <div className="space-y-4">
            <Problem error={checkout.error} />
            <p className="max-w-[68ch] text-body">
              {selection.selected.length > 0
                ? 'Your other seats are still selected. Go back to the map to finish choosing.'
                : 'Choose again from the map — those seats have gone.'}
            </p>
            <Link
              to={`/events/${eventId}`}
              className="inline-flex min-h-11 items-center justify-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost"
            >
              Back to the seat map
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
