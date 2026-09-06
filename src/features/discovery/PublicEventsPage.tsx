import { useState } from 'react'
import { Link } from 'react-router'
import { formatMoney } from '~/shared/format'
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

type Filters = { city: string; from: string; to: string }
const NOTHING: Filters = { city: '', from: '', to: '' }

/**
 * What is on sale, ordered by when it starts.
 *
 * requirements/009: no ranking, no relevance, no personalisation. A list of events in the
 * order they happen is what somebody looking for something to go to actually wants, and it
 * is the same list for everyone - which is worth keeping deliberately, not by omission.
 */
export function PublicEventsPage() {
  const [form, setForm] = useState<Filters>(NOTHING)
  // Applied on submit rather than on every keystroke: a filter that refetches while somebody
  // is still typing "Hà Nội" spends four requests answering questions nobody asked.
  const [applied, setApplied] = useState<Filters>(NOTHING)
  const events = usePublicEvents({
    city: applied.city || undefined,
    startsAfter: startOfDay(applied.from),
    startsBefore: endOfDay(applied.to),
  })
  const rows = events.data?.pages.flatMap((page) => page.items ?? []) ?? []
  const filtered = applied.city !== '' || applied.from !== '' || applied.to !== ''

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
          setApplied({ city: form.city.trim(), from: form.from, to: form.to })
        }}
      >
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
          <Button variant="secondary" className="w-auto">
            Search
          </Button>
          {filtered && (
            <Button
              variant="ghost"
              className="w-auto"
              type="button"
              onClick={() => {
                setForm(NOTHING)
                setApplied(NOTHING)
              }}
            >
              Clear
            </Button>
          )}
        </div>
        {/*
          Said once, under the whole row rather than as a hint on one field: it is true of both
          dates, and a hint inside one Field also pushes that field's box out of line with its
          neighbours. The browser's clock is right here and nowhere else on the page, which is
          exactly why it is worth a sentence - a filter quietly reading a venue's zone would be
          indistinguishable from a filter that was wrong.
        */}
        <p className="text-body text-ink-soft">
          Dates are read in your own timezone. Every time below is the venue&rsquo;s.
        </p>
      </form>

      <Problem error={events.error} />

      {events.isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState headline={filtered ? 'Nothing matches that' : 'Nothing on sale yet'}>
          {filtered
            ? 'Try a wider date range or another city, or clear the filter.'
            : 'Events appear here the moment an organizer puts one on sale.'}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {rows.map((event) => (
            <li key={event.id}>
              <Link
                to={`/events/${event.id}`}
                className={cx(
                  'block border-2 border-ink bg-paper shadow-raised',
                  'transition-[transform,box-shadow] duration-[60ms] ease-linear',
                  'hover:shadow-hover active:translate-x-1 active:translate-y-1 active:shadow-none',
                  'motion-reduce:transition-none',
                )}
              >
                {/* Flush to the card's inner edge, so the card's own border is the only one
                    around it and a card without a cover is not a card with a gap. */}
                <CoverImage
                  src={event.coverImageUrl}
                  alt={event.coverImageAlt}
                  className="border-0 border-b-2"
                />
                <div className="p-6">
                  <h2 className="text-heading">{event.title}</h2>
                  <p className="mt-1 text-body text-ink-soft">
                    {event.venueName}, {event.city} · {event.organizationName}
                  </p>
                  <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
                    {/* Always the venue's clock, never the reader's (nfr.md). */}
                    <TimeWithZone iso={event.startsAt} timeZone={event.timezone} />
                    {event.priceFrom && (
                      <span className="text-body">
                        from{' '}
                        <span className="font-numeric text-numeric-lg">
                          {formatMoney(event.priceFrom)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
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
