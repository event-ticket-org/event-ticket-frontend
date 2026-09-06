import { useState } from 'react'
import { Link } from 'react-router'
import type { Event } from '~/api/types'
import { Button, Card, Problem, StatusChip, inputClass } from '~/shared/ui'
import { useCancelEvent, useEventCancellation } from './refund-hooks'

/**
 * The most destructive thing anybody can do in this application.
 *
 * Closing sales stops new Orders and leaves every Ticket good. Cancelling voids all of them
 * and gives the money back, and nothing undoes it - so this says what will happen in numbers
 * before it asks, and costs a sentence explaining why.
 *
 * That sentence is not friction for its own sake: the contract requires it because the buyer
 * is sent it, and "your event was cancelled" with no reason generates the support request it
 * was meant to replace.
 */
export function CancelEventPanel({ event }: { event: Event }) {
  const cancel = useCancelEvent(event.id)
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')

  const sold = event.soldCount ?? 0

  if (!confirming) {
    return (
      <Button variant="ghost" className="w-auto px-0" onClick={() => setConfirming(true)}>
        Cancel this event
      </Button>
    )
  }

  return (
    <Card className="w-full">
      <h3 className="text-heading">Cancel {event.title}?</h3>
      <ul className="mt-3 max-w-[68ch] list-disc space-y-1 pl-5 text-body">
        <li>Every ticket stops admitting anybody, immediately.</li>
        <li>
          {sold === 0
            ? 'Nothing has been sold, so there is no money to give back.'
            : `Every paid order is refunded — ${sold} ${sold === 1 ? 'seat' : 'seats'} sold.`}
        </li>
        <li>Everyone who bought a ticket is emailed the reason you give below.</li>
        <li>It cannot be undone. Closing sales is the reversible one.</li>
      </ul>

      <div className="mt-4 space-y-3">
        <label className="block text-label uppercase" htmlFor="cancel-reason">
          Why, in one sentence
        </label>
        <input
          id="cancel-reason"
          className={inputClass}
          value={reason}
          maxLength={500}
          placeholder="The venue flooded."
          onChange={(change) => setReason(change.target.value)}
          autoFocus
        />
        <p className="max-w-[68ch] text-body text-ink-soft">
          Refunds are started one order at a time and settle when each provider confirms, so
          this can take a moment on a large event.
        </p>
      </div>

      <Problem error={cancel.error} />

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <Button
          variant="ghost"
          className="w-auto"
          onClick={() => {
            setConfirming(false)
            setReason('')
          }}
        >
          Keep the event
        </Button>
        <Button
          variant="destructive"
          className="w-auto"
          pending={cancel.isPending}
          disabled={reason.trim() === ''}
          onClick={() => cancel.mutate(reason.trim())}
        >
          Cancel and refund everybody
        </Button>
      </div>
    </Card>
  )
}

/**
 * requirements/008 criterion 7: how it is going, per Order.
 *
 * This exists because a bulk refund partially fails, and a single success or failure for the
 * whole operation would hide exactly the information needed to finish it by hand. The failed
 * ones are named; the ones that worked are a number, because nobody has to do anything about
 * those.
 */
export function CancellationProgress({ event }: { event: Event }) {
  const cancellation = useEventCancellation(event.id, event.status === 'CANCELLED')

  if (cancellation.isLoading) {
    return <p className="text-body text-ink-soft">Loading…</p>
  }
  if (!cancellation.data) {
    return <Problem error={cancellation.error} />
  }

  const { pending = 0, refunded = 0, failed = 0, reason, orders = [] } = cancellation.data
  const stuck = orders.filter((order) => order.status === 'REFUND_FAILED')

  return (
    <Card>
      <h2 className="text-heading">Cancelled</h2>
      {reason && <p className="mt-2 max-w-[68ch] text-body">{reason}</p>}

      {orders.length === 0 ? (
        <p className="mt-4 max-w-[68ch] text-body text-ink-soft">
          Nothing had been sold, so there was no money to give back.
        </p>
      ) : (
        <>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            <Count label="Refunded" value={refunded} />
            <Count label="Still going" value={pending} />
            <Count label="Failed" value={failed} />
          </dl>

          {pending > 0 && (
            <p className="mt-4 max-w-[68ch] text-body text-ink-soft">
              Waiting for the payment provider on {pending}{' '}
              {pending === 1 ? 'order' : 'orders'}. This page keeps itself up to date.
            </p>
          )}

          {stuck.length > 0 && (
            // The whole reason this screen reports per Order. These are the ones somebody has
            // to finish by hand, and the provider's own words are what tells them how.
            <div className="mt-4 border-2 border-stop p-4">
              <p className="text-body-strong">
                {stuck.length === 1
                  ? 'One refund did not go through.'
                  : `${stuck.length} refunds did not go through.`}{' '}
                The money is still with you.
              </p>
              <ul className="mt-3 space-y-2">
                {stuck.map((order) => (
                  <li key={order.orderId} className="flex flex-wrap items-baseline gap-3">
                    <StatusChip status={order.status} />
                    <span className="text-body">
                      {order.failureReason ?? 'The provider gave no reason.'}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to={`/manage/events/${event.id}/orders`}
                className="mt-3 inline-block text-body-strong underline underline-offset-4"
              >
                Open the orders and try again
              </Link>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-label uppercase text-ink-soft">{label}</dt>
      <dd className="font-numeric text-numeric-lg">{value}</dd>
    </div>
  )
}
