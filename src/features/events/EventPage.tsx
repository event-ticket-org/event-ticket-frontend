import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { CancelEventPanel, CancellationProgress } from '~/features/refunds/CancelEvent'
import { CoverField } from './CoverField'
import { ApiError } from '~/api/errors'
import type { Event, Money, PricingTierInput, Venue } from '~/api/types'
import { formatMoney } from '~/shared/format'
import {
  Button,
  Card,
  Field,
  Problem,
  StatusChip,
  TimeWithZone,
  cx,
  inputClass,
} from '~/shared/ui'
import { useVenue } from '~/features/venues/venue-hooks'
import { useCloseSales, useEvent, usePublishEvent, useUpdateEvent } from './event-hooks'
import { useSetPricingTiers } from './pricing-hooks'
import { instantFromZoned, zonedInputValue } from './zoned-time'
import { hasProblem, scheduleProblems } from './schedule'

export function EventPage() {
  const { eventId = '' } = useParams()
  const event = useEvent(eventId)
  const venue = useVenue(event.data?.venueId ?? '')

  if (event.isLoading) {
    return <p className="text-body text-ink-soft">Loading…</p>
  }
  if (event.error || !event.data) {
    return <Problem error={event.error ?? new Error('That event is not here.')} />
  }
  if (!venue.data) {
    return <p className="text-body text-ink-soft">Loading…</p>
  }

  return (
    <div className="space-y-8">
      <Header event={event.data} venue={venue.data} />
      {/* First, because a cancelled Event is a thing being finished rather than edited, and
          the forms below it are about an event that is still happening. */}
      {event.data.status === 'CANCELLED' && <CancellationProgress event={event.data} />}
      <Details eventId={eventId} event={event.data} />
      <Schedule eventId={eventId} event={event.data} venue={venue.data} />
      <Pricing eventId={eventId} event={event.data} />
    </div>
  )
}

function Header({ event, venue }: { event: Event; venue: Venue }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link to="/manage/events" className="text-label uppercase underline underline-offset-4">
          Events
        </Link>
        <h1 className="mt-2 text-title">{event.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-body text-ink-soft">
          <Link
            to={`/manage/venues/${venue.id}`}
            className="underline underline-offset-4"
          >
            {venue.name}
          </Link>
          <TimeWithZone iso={event.startsAt} timeZone={venue.timezone} />
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {(event.soldCount ?? 0) > 0 && (
          <Link
            to={`/manage/events/${event.id}/orders`}
            className="font-numeric text-numeric underline underline-offset-4"
          >
            {event.soldCount} sold
          </Link>
        )}
        {/* requirements/008 criterion 10, where an organizer would look for it. Loud, because
            it is money taken for seats that were never delivered. */}
        {(event.refundRequiredCount ?? 0) > 0 && (
          <Link
            to={`/manage/events/${event.id}/orders`}
            className="border-2 border-ink bg-hold px-2 py-1 text-label uppercase text-ink"
          >
            {event.refundRequiredCount} owed a refund
          </Link>
        )}
        <StatusChip status={event.status} />
      </div>
    </div>
  )
}

function Details({ eventId, event }: { eventId: string; event: Event }) {
  const update = useUpdateEvent(eventId)
  const [form, setForm] = useState({
    title: event.title,
    description: event.description ?? '',
    coverImageAlt: event.coverImageAlt ?? '',
    listed: event.listed ?? true,
  })
  const changed =
    form.title !== event.title ||
    form.description !== (event.description ?? '') ||
    form.coverImageAlt !== (event.coverImageAlt ?? '') ||
    form.listed !== (event.listed ?? true)

  return (
    <Card>
      <form
        className="space-y-6"
        onSubmit={(submit) => {
          submit.preventDefault()
          // Only what changed. `UpdateEvent` treats any startsAt it receives that differs
          // from the stored one as a reschedule, so the schedule is a separate form and
          // this one never sends a time.
          update.mutate({
            title: form.title,
            description: form.description,
            // Only when there is a picture to describe: the server refuses alt text for an
            // absent cover, and so does the database.
            ...(event.coverImageUrl ? { coverImageAlt: form.coverImageAlt } : {}),
            listed: form.listed,
          })
        }}
      >
        <h2 className="text-heading">Details</h2>
        <Problem error={update.error} />
        <Field label="Title">
          <input
            className={inputClass}
            value={form.title}
            maxLength={200}
            required
            onChange={(change) => setForm({ ...form, title: change.target.value })}
          />
        </Field>
        <Field label="Description">
          <textarea
            className={cx(inputClass, 'min-h-32')}
            value={form.description}
            maxLength={5000}
            onChange={(change) => setForm({ ...form, description: change.target.value })}
          />
        </Field>
        {/*
          Outside this form on purpose. Uploading and removing are their own endpoints and take
          effect at once; what the picture *shows* is text like any other and saves with the
          title beside it.
        */}
        <CoverField event={event} />
        {event.coverImageUrl && (
          <Field
            label="What the cover shows"
            hint="For people who cannot see it. Describe the picture, not the event — its title is already beside it."
          >
            <input
              className={inputClass}
              value={form.coverImageAlt}
              maxLength={200}
              placeholder="A crowd lit from behind, arms raised"
              onChange={(change) => setForm({ ...form, coverImageAlt: change.target.value })}
            />
          </Field>
        )}
        <label className="flex items-start gap-3 text-body">
          <input
            type="checkbox"
            className="mt-1 size-5 border-2 border-ink"
            checked={form.listed}
            onChange={(change) => setForm({ ...form, listed: change.target.checked })}
          />
          <span>
            Show in public listings
            <span className="block text-body text-ink-soft">
              Unlisted events still have a page and still sell — they are simply not browsable.
            </span>
          </span>
        </label>
        <div className="flex justify-end">
          <Button className="w-auto" disabled={!changed} pending={update.isPending}>
            Save details
          </Button>
        </div>
      </form>
    </Card>
  )
}

/**
 * The start time and the admission window move together, in one request.
 *
 * <p>Exported for `schedule-form.test.tsx`. `schedule.ts` proves the rules; this component is
 * where they either reach a person or do not, and that half is not provable from the rules.
 *
 * `Event.reschedule` validates all three at once, so moving the start on its own would be
 * refused against the *old* window - which is how a legitimate reschedule gets rejected for
 * a reason nobody can act on.
 */
export function Schedule({
  eventId,
  event,
  venue,
}: {
  eventId: string
  event: Event
  venue: Venue
}) {
  const update = useUpdateEvent(eventId)
  const zone = venue.timezone
  const [form, setForm] = useState({
    startsAt: zonedInputValue(event.startsAt, zone),
    doorsOpenAt: event.doorsOpenAt ? zonedInputValue(event.doorsOpenAt, zone) : '',
    endsAt: event.endsAt ? zonedInputValue(event.endsAt, zone) : '',
  })

  const published = event.status === 'PUBLISHED' || event.status === 'SALES_CLOSED'
  // Recomputed on every keystroke rather than on submit, which is the whole point: a person
  // should be told while they are still looking at the field they got wrong.
  const problems = scheduleProblems(form, { timeZone: zone, published, now: new Date() })
  const startMoved = form.startsAt !== zonedInputValue(event.startsAt, zone)
  const changed =
    startMoved ||
    form.doorsOpenAt !== (event.doorsOpenAt ? zonedInputValue(event.doorsOpenAt, zone) : '') ||
    form.endsAt !== (event.endsAt ? zonedInputValue(event.endsAt, zone) : '')

  const zoneName = zone.split('/').pop()?.replace(/_/g, ' ') ?? zone

  return (
    <Card>
      <form
        className="space-y-6"
        onSubmit={(submit) => {
          submit.preventDefault()
          // The server refuses these too. Stopping here saves a round trip and, more to the
          // point, keeps the answer beside the field instead of at the top of the form.
          if (hasProblem(problems)) return
          update.mutate({
            startsAt: instantFromZoned(form.startsAt, zone),
            ...(form.doorsOpenAt
              ? { doorsOpenAt: instantFromZoned(form.doorsOpenAt, zone) }
              : {}),
            ...(form.endsAt ? { endsAt: instantFromZoned(form.endsAt, zone) } : {}),
          })
        }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-heading">Schedule</h2>
          <span className="text-label uppercase text-ink-soft">
            All times in {zoneName} time
          </span>
        </div>

        <Problem error={update.error} />

        {update.data?.notifyCount != null && (
          <p className="border-2 border-ink bg-go px-4 py-3 text-body text-ink">
            Rescheduled. {update.data.notifyCount} ticket{' '}
            {update.data.notifyCount === 1 ? 'holder was' : 'holders were'} notified.
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="Doors open" hint="When admission begins." problem={problems.doorsOpenAt}>
            <input
              className={inputClass}
              type="datetime-local"
              value={form.doorsOpenAt}
              onChange={(change) => setForm({ ...form, doorsOpenAt: change.target.value })}
            />
          </Field>
          <Field label="Starts" problem={problems.startsAt}>
            <input
              className={inputClass}
              type="datetime-local"
              value={form.startsAt}
              required
              onChange={(change) => setForm({ ...form, startsAt: change.target.value })}
            />
          </Field>
          <Field label="Ends" hint="When admission closes." problem={problems.endsAt}>
            <input
              className={inputClass}
              type="datetime-local"
              value={form.endsAt}
              onChange={(change) => setForm({ ...form, endsAt: change.target.value })}
            />
          </Field>
        </div>

        <p className="max-w-[68ch] text-body text-ink-soft">
          Doors and end time are what the door judges a ticket against: someone early from
          someone late. Publishing needs both.
        </p>

        {published && startMoved && (
          <p className="border-2 border-ink bg-hold px-4 py-3 text-body text-ink">
            This event is on sale. Moving the start time notifies every ticket holder.
          </p>
        )}

        <div className="flex justify-end">
          <Button
            className="w-auto"
            disabled={!changed || hasProblem(problems)}
            pending={update.isPending}
          >
            Save schedule
          </Button>
        </div>
      </form>
    </Card>
  )
}

/**
 * Prices, and the gate they hold shut.
 *
 * Tier names come from the Venue's Seat Map while the Event is a Draft, so this list is not
 * editable here - a tier appears by drawing a seat into it. A null price is a tier named but
 * not yet priced, which is exactly the state publishing refuses.
 */
function Pricing({ eventId, event }: { eventId: string; event: Event }) {
  const setPrices = useSetPricingTiers(eventId)
  const publish = usePublishEvent(eventId)
  const closeSales = useCloseSales(eventId)
  const tiers = event.pricingTiers ?? []

  const [draft, setDraft] = useState<Record<string, string>>({})
  const priceOf = (name: string, current: Money | null) =>
    draft[name] ?? (current ? String(current.amount) : '')

  const changed = tiers.some(
    (tier) => priceOf(tier.name, tier.price) !== (tier.price ? String(tier.price.amount) : ''),
  )

  // The publish refusal names the tiers that blocked it, so the rows can say which.
  const unpriced =
    publish.error instanceof ApiError && Array.isArray(publish.error.details.unpricedTiers)
      ? (publish.error.details.unpricedTiers as string[])
      : []

  const isDraft = event.status === 'DRAFT'
  const onSale = event.status === 'PUBLISHED'

  return (
    <Card>
      <div className="space-y-6">
        <h2 className="text-heading">Pricing</h2>
        <Problem error={setPrices.error ?? publish.error ?? closeSales.error} />

        {tiers.length === 0 ? (
          <p className="max-w-[68ch] text-body text-ink-soft">
            No tiers yet. A tier appears here as soon as a seat is drawn into it on the
            venue&rsquo;s seat map.
          </p>
        ) : (
          <ul className="space-y-3">
            {tiers.map((tier) => (
              <li
                key={tier.name}
                className={cx(
                  'flex flex-wrap items-end justify-between gap-4 border-2 px-4 py-3',
                  unpriced.includes(tier.name) ? 'border-stop bg-paper' : 'border-ink bg-paper',
                )}
              >
                <div>
                  <p className="text-body-strong">{tier.name}</p>
                  <p className="text-body text-ink-soft">
                    {tier.price ? formatMoney(tier.price) : 'No price yet'}
                  </p>
                </div>
                <div className="w-48">
                  <Field label="Price, đồng">
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      step={1000}
                      inputMode="numeric"
                      // VND has no minor unit: the amount *is* the dong (nfr.md). No
                      // multiplying by a hundred anywhere in this form.
                      value={priceOf(tier.name, tier.price)}
                      disabled={!isDraft}
                      onChange={(change) =>
                        setDraft({ ...draft, [tier.name]: change.target.value })
                      }
                    />
                  </Field>
                </div>
              </li>
            ))}
          </ul>
        )}

        {isDraft && tiers.length > 0 && (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              className="w-auto"
              disabled={!changed}
              pending={setPrices.isPending}
              onClick={() => {
                const priced: PricingTierInput[] = tiers.flatMap((tier) => {
                  const typed = priceOf(tier.name, tier.price).trim()
                  return typed === ''
                    ? []
                    : [{ name: tier.name, price: { amount: Number(typed), currency: 'VND' } }]
                })
                setPrices.mutate(priced, { onSuccess: () => setDraft({}) })
              }}
            >
              Save prices
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink pt-6">
          <p className="max-w-[68ch] text-body text-ink-soft">
            {isDraft
              ? 'Publishing copies the venue’s seat map into this event, fixes it for the life of the event, and puts tickets on sale.'
              : onSale
                ? 'On sale. Closing sales stops new orders; tickets already sold stay valid.'
                : 'Sales are closed. Tickets already sold stay valid.'}
          </p>
          {isDraft && (
            <Button
              className="w-auto"
              pending={publish.isPending}
              onClick={() => publish.mutate()}
            >
              Publish
            </Button>
          )}
          {onSale && (
            <Button
              variant="destructive"
              className="w-auto"
              pending={closeSales.isPending}
              onClick={() => closeSales.mutate()}
            >
              Close sales
            </Button>
          )}
        </div>

        {/* Published and not yet cancelled: the reversible action above is loud and this one
            is quiet, which is DESIGN.md's rule about the destructive path being the harder. */}
        {!isDraft && event.status !== 'CANCELLED' && (
          <div className="border-t-2 border-ink pt-6">
            <CancelEventPanel event={event} />
          </div>
        )}
      </div>
    </Card>
  )
}
