import { useId, useState } from 'react'
import { Link } from 'react-router'
import type { PublicEventSummary } from '~/api/types'
import { formatMoney, monthInZone, timeUntil } from '~/shared/format'
import {
  Button,
  CoverImage,
  EmptyState,
  Field,
  Problem,
  TimeWithZone,
  cx,
  inputClass,
} from '~/shared/ui'
import { endOfDay, startOfDay, usePublicEvents } from './public-hooks'

type Filters = { q: string; city: string; from: string; to: string }
const NOTHING: Filters = { q: '', city: '', from: '', to: '' }

/**
 * Seats left below which the number is worth saying out loud.
 *
 * A flat number rather than a proportion, and that is a real limitation rather than a
 * simplification: the contract carries how many seats are left and not how many there were, so
 * "ten left" reads the same for a room of twenty and a room of two thousand. Ten of two
 * thousand deserves to be louder than this is. Fixing it properly means the Event summary
 * carrying its capacity, which is a contract change and was not worth making before anybody had
 * looked at this one.
 */
const FEW = 10

/**
 * What is on sale, ordered by when it starts.
 *
 * requirements/009: no ranking, no relevance, no personalisation. A list of events in the order
 * they happen is what somebody looking for something to go to actually wants, and it is the
 * same list for everyone - which is worth keeping deliberately, not by omission. The text
 * filter added in criterion 4 changes which events appear and never the order they appear in.
 */
export function PublicEventsPage() {
  const [form, setForm] = useState<Filters>(NOTHING)
  // Applied on submit rather than on every keystroke: a filter that refetches while somebody
  // is still typing "Hà Nội" spends four requests answering questions nobody asked.
  const [applied, setApplied] = useState<Filters>(NOTHING)
  const [showFilters, setShowFilters] = useState(false)
  const panelId = useId()

  const events = usePublicEvents({
    q: applied.q || undefined,
    city: applied.city || undefined,
    startsAfter: startOfDay(applied.from),
    startsBefore: endOfDay(applied.to),
  })
  const rows = events.data?.pages.flatMap((page) => page.items ?? []) ?? []
  const narrowed = countNarrowing(applied)

  function apply(next: Filters) {
    setForm(next)
    setApplied({ ...next, q: next.q.trim(), city: next.city.trim() })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display">What&rsquo;s on</h1>
        <p className="mt-2 max-w-[68ch] text-body text-ink-soft">
          Events on sale, soonest first.
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(submit) => {
          submit.preventDefault()
          apply(form)
        }}
      >
        {/*
          The search leads, and the rest of the filters are folded away behind it.

          The form used to be the first thing on the page - three fields and a sentence, about
          a third of the first screen before a single event appeared. On a shell whose whole
          job is "one decision per screen" the decision should be which event, not how to
          narrow a list nobody has seen yet.
        */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label="Search">
              <input
                className={inputClass}
                type="search"
                value={form.q}
                placeholder="Band, show or festival"
                onChange={(change) => setForm({ ...form, q: change.target.value })}
              />
            </Field>
          </div>
          <Button variant="secondary" className="w-auto">
            Search
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={cx(
              'min-h-11 border-2 border-ink px-4 text-label uppercase',
              showFilters ? 'bg-ink text-paper' : 'bg-paper',
            )}
            aria-expanded={showFilters}
            aria-controls={panelId}
            onClick={() => setShowFilters(!showFilters)}
          >
            City and dates
          </button>

          {/*
            Applied filters stay visible whether or not the panel is open. A narrowed list
            behind a closed panel is the trap this arrangement would otherwise introduce: an
            empty page that looks like an empty product, with the reason folded away.
          */}
          {narrowed.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className="flex min-h-11 items-center gap-2 border-2 border-ink bg-paper-sunk px-3 text-body"
              // From `applied`, not from `form`. A chip removes one of the filters that are
              // narrowing the list right now; basing it on the form would also commit whatever
              // somebody had half-typed into the search box and not submitted.
              onClick={() => apply({ ...applied, [filter.key]: '' })}
            >
              <span>{filter.label}</span>
              <span aria-hidden="true">✕</span>
              <span className="sr-only">Remove this filter</span>
            </button>
          ))}
        </div>

        <div id={panelId} hidden={!showFilters} className="space-y-3 border-2 border-ink p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Field label="City">
                <input
                  className={inputClass}
                  value={form.city}
                  placeholder="Hà Nội"
                  onChange={(change) => setForm({ ...form, city: change.target.value })}
                />
              </Field>
            </div>
            <div className="min-w-36 flex-1">
              <Field label="From">
                <input
                  className={inputClass}
                  type="date"
                  value={form.from}
                  max={form.to || undefined}
                  onChange={(change) => setForm({ ...form, from: change.target.value })}
                />
              </Field>
            </div>
            <div className="min-w-36 flex-1">
              <Field label="To">
                <input
                  className={inputClass}
                  type="date"
                  value={form.to}
                  min={form.from || undefined}
                  onChange={(change) => setForm({ ...form, to: change.target.value })}
                />
              </Field>
            </div>
          </div>
          {/*
            Said once, under the whole row rather than as a hint on one field: it is true of
            both dates, and a hint inside one Field also pushes that field's box out of line
            with its neighbours. The browser's clock is right here and nowhere else on the page,
            which is exactly why it is worth a sentence - a filter quietly reading a venue's
            zone would be indistinguishable from a filter that was wrong.
          */}
          <p className="text-body text-ink-soft">
            Dates are read in your own timezone. Every time below is the venue&rsquo;s.
          </p>
          {narrowed.length > 0 && (
            <Button
              variant="ghost"
              className="w-auto"
              type="button"
              onClick={() => apply(NOTHING)}
            >
              Clear everything
            </Button>
          )}
        </div>
      </form>

      <Problem error={events.error} />

      {events.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState headline={narrowed.length > 0 ? 'Nothing matches that' : 'Nothing on sale yet'}>
          {narrowed.length > 0
            ? 'Try a different word, a wider date range, or another city.'
            : 'Events appear here the moment an organizer puts one on sale.'}
        </EmptyState>
      ) : (
        <Listing rows={rows} />
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

/**
 * The list, broken by month.
 *
 * A listing ordered by start time is a calendar whether or not it says so, and a reader
 * scrolling one is asking "how far ahead am I now". The separator answers that once per month
 * instead of making every card answer it alone.
 */
function Listing({ rows }: { rows: PublicEventSummary[] }) {
  let month = ''

  return (
    <ul className="space-y-4">
      {rows.map((event) => {
        const label = monthInZone(event.startsAt, event.timezone)
        const heading = label === month ? null : label
        month = label

        return (
          <li key={event.id} className={cx(heading && 'space-y-4', heading && 'pt-2')}>
            {heading && (
              <h2 className="border-b-2 border-ink pb-1 text-label uppercase">{heading}</h2>
            )}
            <EventCard event={event} />
          </li>
        )
      })}
    </ul>
  )
}

function EventCard({ event }: { event: PublicEventSummary }) {
  const until = timeUntil(event.startsAt)
  const soldOut = event.seatsAvailable === 0

  return (
    <Link
      to={`/events/${event.id}`}
      className={cx(
        'block border-2 border-ink bg-paper shadow-raised',
        'transition-[transform,box-shadow] duration-[60ms] ease-linear',
        'hover:shadow-hover active:translate-x-1 active:translate-y-1 active:shadow-none',
        'motion-reduce:transition-none',
      )}
    >
      {/* Flush to the card's inner edge, so the card's own border is the only one around it
          and a card without a cover is not a card with a gap. A band rather than the 16:9
          hero the event's own page uses - see DESIGN.md, and the card heights that prompted it. */}
      <CoverImage
        src={event.coverImageUrl}
        alt={event.coverImageAlt}
        sizes={event.coverImageSizes}
        shape="band"
        className="border-0 border-b-2"
      />
      <div className="space-y-2 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-heading">{event.title}</h3>
          {soldOut && <SoldOut />}
        </div>
        <p className="text-body text-ink-soft">
          {event.venueName}, {event.city} · {event.organizationName}
        </p>
        {/* The time gets its own line rather than sharing one with the price. It carries a
            date, a clock and the zone that clock belongs to, which is long enough that the
            pair wrapped at every width the public shell allows - and a price pushed onto its
            own line by `justify-between` lands at the left, reading as a mistake rather than
            as a column. */}
        <p>
          {/* Always the venue's clock, never the reader's (nfr.md). The duration beside it is
              safe to show because it is the same length of time in either zone. */}
          <TimeWithZone iso={event.startsAt} timeZone={event.timezone} />
          {until && <span className="ml-2 text-body text-ink-soft">{until}</span>}
        </p>

        {/* What it costs, and what is left of it: the two things somebody is weighing, on one
            line and at opposite ends of it.

            Neither appears for a sold-out event. DESIGN.md says a seat you cannot buy has no
            price band worth reading, and the same is true of an event - the chip beside the
            title has already answered the only question left. */}
        {!soldOut && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            {event.priceFrom ? (
              <span className="text-body">
                from{' '}
                <span className="font-numeric text-numeric-lg">
                  {formatMoney(event.priceFrom)}
                </span>
              </span>
            ) : (
              <span />
            )}
            {event.seatsAvailable <= FEW && (
              <span className="text-body-strong">
                {event.seatsAvailable} {event.seatsAvailable === 1 ? 'seat' : 'seats'} left
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

/**
 * requirements/009 criterion 11: a sold-out Event is listed, saying so.
 *
 * A word and a box rather than a colour. DESIGN.md's rule that colour is never the only signal
 * applies with particular force to the one label here that changes whether somebody bothers to
 * tap - and the card stays at full contrast, because a dimmed card is harder to read for
 * everybody in exchange for a hint that the word already gives.
 */
function SoldOut() {
  return (
    <span className="border-2 border-ink bg-paper-sunk px-2 py-0.5 text-label uppercase">
      Sold out
    </span>
  )
}

/**
 * Cards on their way, not covers that are missing.
 *
 * DESIGN.md forbids a placeholder where a cover is absent, and allows this: the difference is
 * whether the content is coming. These disappear when the rows arrive; a cover placeholder
 * would stand in for a picture that does not exist.
 *
 * No shimmer. A pulsing gradient is the house style everywhere else and belongs to a system
 * with soft edges and gradients in it, which this is not.
 */
function Loading() {
  return (
    <>
      <p className="sr-only" role="status">
        Loading events
      </p>
      <ul className="space-y-4" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <li key={row} className="border-2 border-ink bg-paper shadow-raised">
            <div className="h-35 border-b-2 border-ink bg-paper-sunk" />
            <div className="space-y-3 p-5">
              <div className="h-5 w-2/3 bg-paper-sunk" />
              <div className="h-4 w-1/2 bg-paper-sunk" />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/** The filters currently narrowing the list, as the chips that can remove them. */
function countNarrowing(applied: Filters): { key: keyof Filters; label: string }[] {
  const chips: { key: keyof Filters; label: string }[] = []
  if (applied.q) {
    chips.push({ key: 'q', label: `“${applied.q}”` })
  }
  if (applied.city) {
    chips.push({ key: 'city', label: applied.city })
  }
  if (applied.from) {
    chips.push({ key: 'from', label: `From ${applied.from}` })
  }
  if (applied.to) {
    chips.push({ key: 'to', label: `To ${applied.to}` })
  }
  return chips
}
