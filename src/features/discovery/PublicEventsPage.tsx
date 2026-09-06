import { useState } from 'react'
import { Link } from 'react-router'
import { formatMoney } from '~/shared/format'
import { Button, EmptyState, Field, Problem, TimeWithZone, cx, inputClass } from '~/shared/ui'
import { usePublicEvents } from './public-hooks'

/**
 * What is on sale, ordered by when it starts.
 *
 * requirements/009: no ranking, no relevance, no personalisation. A list of events in the
 * order they happen is what somebody looking for something to go to actually wants, and it
 * is the same list for everyone - which is worth keeping deliberately, not by omission.
 */
export function PublicEventsPage() {
  const [city, setCity] = useState('')
  const [applied, setApplied] = useState('')
  const events = usePublicEvents({ city: applied || undefined })
  const rows = events.data?.items ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display">What&rsquo;s on</h1>
        <p className="mt-2 max-w-[68ch] text-body text-ink-soft">
          Events on sale, soonest first.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(submit) => {
          submit.preventDefault()
          setApplied(city.trim())
        }}
      >
        <div className="min-w-64 flex-1">
          <Field label="City">
            <input
              className={inputClass}
              value={city}
              placeholder="Hà Nội"
              onChange={(change) => setCity(change.target.value)}
            />
          </Field>
        </div>
        <Button variant="secondary" className="w-auto">
          Search
        </Button>
        {applied && (
          <Button
            variant="ghost"
            className="w-auto"
            type="button"
            onClick={() => {
              setCity('')
              setApplied('')
            }}
          >
            Clear
          </Button>
        )}
      </form>

      <Problem error={events.error} />

      {events.isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState headline={applied ? `Nothing in ${applied}` : 'Nothing on sale yet'}>
          {applied
            ? 'No events there at the moment. Try another city, or clear the filter.'
            : 'Events appear here the moment an organizer puts one on sale.'}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {rows.map((event) => (
            <li key={event.id}>
              <Link
                to={`/events/${event.id}`}
                className={cx(
                  'block border-2 border-ink bg-paper p-6 shadow-raised',
                  'transition-[transform,box-shadow] duration-[60ms] ease-linear',
                  'hover:shadow-hover active:translate-x-1 active:translate-y-1 active:shadow-none',
                  'motion-reduce:transition-none',
                )}
              >
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
