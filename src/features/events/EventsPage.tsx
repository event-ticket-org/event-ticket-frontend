import { useState } from 'react'
import { Link } from 'react-router'
import type { EventStatus, Venue } from '~/api/types'
import { formatInZone } from '~/shared/format'
import {
  Button,
  Card,
  EmptyState,
  Field,
  Problem,
  Segment,
  Segmented,
  StatusChip,
  cx,
  inputClass,
} from '~/shared/ui'
import { useVenues } from '~/features/venues/venue-hooks'
import { useCreateEvent, useEvents } from './event-hooks'
import { instantFromZoned } from './zoned-time'

const FILTERS: { status: EventStatus | 'ALL'; label: string }[] = [
  { status: 'ALL', label: 'All' },
  { status: 'DRAFT', label: 'Draft' },
  { status: 'PUBLISHED', label: 'On sale' },
  { status: 'SALES_CLOSED', label: 'Closed' },
]

export function EventsPage() {
  const [filter, setFilter] = useState<EventStatus | 'ALL'>('ALL')
  const events = useEvents(filter)
  const venues = useVenues()
  const [creating, setCreating] = useState(false)

  const rows = events.data?.pages.flatMap((page) => page.items ?? []) ?? []
  const venueById = new Map(venues.data?.map((venue) => [venue.id, venue]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-title">Events</h1>
        <div className="flex items-center gap-4">
          <Segmented label="Filter events by status">
            {FILTERS.map((option) => (
              <Segment
                key={option.status}
                selected={filter === option.status}
                onClick={() => setFilter(option.status)}
              >
                {option.label}
              </Segment>
            ))}
          </Segmented>
          {!creating && rows.length > 0 && (
            <Button className="w-auto" onClick={() => setCreating(true)}>
              New event
            </Button>
          )}
        </div>
      </div>

      <Problem error={events.error} />

      {creating && <CreateEvent onDone={() => setCreating(false)} />}

      {events.isLoading || venues.isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : venues.data?.length === 0 ? (
        <EmptyState
          headline="A venue comes first"
          action={
            <Link
              to="/manage/venues"
              className="inline-flex min-h-11 items-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost"
            >
              Go to venues
            </Link>
          }
        >
          An event sells the seats of a venue, so there has to be one to sell. Draw its seat
          map once and every event there starts from the same room.
        </EmptyState>
      ) : rows.length === 0 && !creating ? (
        <EmptyState
          headline={filter === 'ALL' ? 'No events yet' : 'Nothing with that status'}
          action={
            filter === 'ALL' ? (
              <Button className="w-auto" onClick={() => setCreating(true)}>
                New event
              </Button>
            ) : undefined
          }
        >
          {filter === 'ALL'
            ? 'An event is a date at a venue. It stays a draft, editable and invisible, until you publish it.'
            : 'Try another status.'}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {rows.map((event) => {
            const venue = venueById.get(event.venueId)
            return (
              <li key={event.id}>
                <Link
                  to={`/manage/events/${event.id}`}
                  className={cx(
                    'flex flex-wrap items-baseline justify-between gap-4 border-2 border-ink bg-paper p-6 shadow-raised',
                    'transition-[transform,box-shadow] duration-[60ms] ease-linear',
                    'hover:shadow-hover active:translate-x-1 active:translate-y-1 active:shadow-none',
                    'motion-reduce:transition-none',
                  )}
                >
                  <div>
                    <h2 className="text-heading">{event.title}</h2>
                    <p className="mt-1 text-body text-ink-soft">
                      {venue ? `${venue.name}, ${venue.city}` : 'Venue'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {venue && (
                      <span className="font-numeric text-numeric">
                        {formatInZone(event.startsAt, venue.timezone)}
                      </span>
                    )}
                    <StatusChip status={event.status} />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {events.hasNextPage && (
        <Button
          variant="secondary"
          className="w-auto"
          pending={events.isFetchingNextPage}
          onClick={() => void events.fetchNextPage()}
        >
          Load more
        </Button>
      )}
    </div>
  )
}

function CreateEvent({ onDone }: { onDone: () => void }) {
  const create = useCreateEvent()
  const venues = useVenues()
  const [venueId, setVenueId] = useState('')
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')

  const venue: Venue | undefined = venues.data?.find((v) => v.id === venueId) ?? venues.data?.[0]
  const zone = venue?.timezone ?? 'Asia/Ho_Chi_Minh'

  return (
    <Card>
      <form
        className="space-y-6"
        onSubmit={(submit) => {
          submit.preventDefault()
          if (!venue) {
            return
          }
          create.mutate(
            {
              title,
              venueId: venue.id,
              // Typed in the venue's clock, sent as the instant it names. Reading this with
              // `new Date(startsAt)` would use the browser's zone, which is right only for
              // as long as the person editing happens to be in the same country.
              startsAt: instantFromZoned(startsAt, zone),
              // Sent rather than left to the contract's default: openapi-typescript makes a
              // property with a default non-optional, so the type requires it either way.
              listed: true,
            },
            { onSuccess: onDone },
          )
        }}
      >
        <h2 className="text-heading">New event</h2>
        <Problem error={create.error} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Title">
            <input
              className={inputClass}
              value={title}
              maxLength={200}
              required
              autoFocus
              onChange={(change) => setTitle(change.target.value)}
            />
          </Field>
          <Field label="Venue" hint="Fixed once the event exists — its seat map is what sells.">
            <select
              className={inputClass}
              value={venue?.id ?? ''}
              required
              onChange={(change) => setVenueId(change.target.value)}
            >
              {venues.data?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}, {option.city}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Starts"
            hint={venue ? `In ${venue.timezone.split('/').pop()?.replace(/_/g, ' ')} time, where the venue is.` : undefined}
          >
            <input
              className={inputClass}
              type="datetime-local"
              value={startsAt}
              required
              onChange={(change) => setStartsAt(change.target.value)}
            />
          </Field>
        </div>
        <p className="max-w-[68ch] text-body text-ink-soft">
          Doors and end time are set on the event itself. Publishing needs them, along with a
          price for every tier — nothing here is on sale until you say so.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" className="w-auto" type="button" onClick={onDone}>
            Cancel
          </Button>
          <Button
            className="w-auto"
            pending={create.isPending}
            disabled={!venue || title.trim() === '' || startsAt === ''}
          >
            Create event
          </Button>
        </div>
      </form>
    </Card>
  )
}
