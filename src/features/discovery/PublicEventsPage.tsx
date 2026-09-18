import { useId, useState } from 'react'
import { Link } from 'react-router'
import type { PublicEventSummary } from '~/api/types'
import { useCategories, useCities } from '~/api/vocabulary-hooks'
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
import { EventRail } from './EventRail'
import { Hero } from './Hero'
import { TrendingRail } from './TrendingRail'
import {
  endOfDay,
  startOfDay,
  thisMonth,
  thisWeekend,
  usePublicEvents,
} from './public-hooks'

type Filters = {
  q: string
  citySlug: string
  categorySlug: string
  from: string
  to: string
  /** A named range, which replaces `from`/`to` rather than joining them. */
  when: 'any' | 'weekend' | 'month'
}
const NOTHING: Filters = {
  q: '',
  citySlug: '',
  categorySlug: '',
  from: '',
  to: '',
  when: 'any',
}

/**
 * How many events a category needs before it gets a row of its own.
 *
 * requirements/009 criterion 16: a row too short to look ranked or selected is not shown at
 * all. Five is the number below which a horizontal rail reads as a fault - three cards and a
 * gap look like something failed to load, where the same three inside the listing below look
 * like three events.
 *
 * The whole home page turns on this. With the ten events currently published no category
 * clears it, so the page is the filter strip and the listing - which is the intended behaviour
 * and not a fallback: the rails light up on their own as the catalogue fills, and nobody has
 * to remember to switch them on.
 */
const RAIL_MINIMUM = 5

/**
 * The share of an Event's seats below which how many are left is worth saying out loud.
 *
 * A proportion, now that the contract carries both numbers. It was a flat ten, and that read
 * the same for a room of twenty and a room of two thousand - which are not the same news. A
 * tenth left is nearly gone at either size, and it is the only reading of "nearly gone" that
 * does not need a second number invented for it.
 *
 * Said as a count and never as urgency: DESIGN.md's voice does not sell, so this is "4 seats
 * left" and not "selling fast". The fact is what a buyer can act on; the adjective is what a
 * ticket site says when it wants them to hurry.
 */
const NEARLY_GONE = 0.1

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
  // Worked out when the filter is applied and kept, never on render. "This month" starts at
  // *now*, and a `now` read on every render is a new query key on every render: each answer
  // re-renders the page, which asks again, forever.
  const [range, setRange] = useState(() => dateRange(NOTHING))
  const [showFilters, setShowFilters] = useState(false)
  const panelId = useId()

  const categories = useCategories()
  const cities = useCities()

  const events = usePublicEvents({
    q: applied.q || undefined,
    citySlug: applied.citySlug || undefined,
    categorySlug: applied.categorySlug || undefined,
    ...range,
  })
  const rows = events.data?.pages.flatMap((page) => page.items ?? []) ?? []
  const narrowed = countNarrowing(applied, categories.data ?? [], cities.data ?? [])

  // Counts come with the first page only - they are the same for every page of a listing, so
  // the server stops computing them once a cursor is involved (requirements/009 criterion 17).
  const facets = events.data?.pages[0]?.categoryFacets ?? []

  // Rails are for browsing, not for reading a result. Once somebody has narrowed the listing
  // they are looking for the thing they asked for, and a row of "you might also like" above it
  // is the site changing the subject.
  const browsing = narrowed.length === 0

  function apply(next: Filters) {
    setForm(next)
    setApplied({ ...next, q: next.q.trim() })
    setRange(dateRange(next))
  }

  return (
    <div className="space-y-8">
      {/*
        The hero sits above the heading rather than under it, which is the one place this page
        follows the reference exactly: the first thing on a discovery page should be something
        to go to, not a label for the page you are already on.

        Only while browsing. Somebody who has searched is looking for what they asked for, and
        a curated banner above their results is the site changing the subject.
      */}
      {browsing && <Hero />}

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

        {/*
          Category first, because it is the question somebody browsing actually has. The counts
          beside each are what the listing would return under the filters already applied -
          criterion 17 - which is why a zero is shown rather than the chip being hidden: a
          greyed chip reading "Thể thao 0" says the other filters emptied it, where a chip
          missing from the strip reads as a category that does not exist.
        */}
        <ul className="flex flex-wrap gap-2">
          <li>
            <Chip
              pressed={applied.categorySlug === ''}
              onClick={() => apply({ ...applied, categorySlug: '' })}
            >
              Everything
            </Chip>
          </li>
          {categories.data?.map((category) => {
            const count = facets.find((facet) => facet.slug === category.slug)?.count
            return (
              <li key={category.slug}>
                <Chip
                  pressed={applied.categorySlug === category.slug}
                  disabled={count === 0}
                  onClick={() => apply({ ...applied, categorySlug: category.slug })}
                >
                  {category.name}
                  {count !== undefined && (
                    <span className="ml-2 font-numeric text-ink-soft">{count}</span>
                  )}
                </Chip>
              </li>
            )
          })}
        </ul>

        {/*
          When, as three named ranges rather than two date boxes. The boxes are still there for
          anybody who wants a specific week; these are the three answers people actually give.
        */}
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={applied.when}
            onChange={(when) => apply({ ...applied, when, from: '', to: '' })}
            options={[
              { value: 'any', label: 'Any time' },
              { value: 'weekend', label: 'This weekend' },
              { value: 'month', label: 'This month' },
            ]}
          />
        </div>

        {/*
          Cities as their own row, and only three of them plus "Everywhere". Ticketbox puts
          four tiles at the foot of a page that is already long; here the catalogue is small
          enough that a city is a filter somebody uses before scrolling, not after.
        */}
        <ul className="flex flex-wrap gap-2">
          <li>
            <Chip
              pressed={applied.citySlug === ''}
              onClick={() => apply({ ...applied, citySlug: '' })}
            >
              Everywhere
            </Chip>
          </li>
          {cities.data?.map((city) => (
            <li key={city.slug}>
              <Chip
                pressed={applied.citySlug === city.slug}
                onClick={() => apply({ ...applied, citySlug: city.slug })}
              >
                {city.name}
              </Chip>
            </li>
          ))}
        </ul>

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
            Exact dates
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
              onClick={() => apply({ ...applied, ...filter.clear })}
            >
              <span>{filter.label}</span>
              <span aria-hidden="true">✕</span>
              <span className="sr-only">Remove this filter</span>
            </button>
          ))}
        </div>

        <div id={panelId} hidden={!showFilters} className="space-y-3 border-2 border-ink p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-36 flex-1">
              <Field label="From">
                <input
                  className={inputClass}
                  type="date"
                  value={form.from}
                  max={form.to || undefined}
                  onChange={(change) =>
                    setForm({ ...form, from: change.target.value, when: 'any' })
                  }
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
                  onChange={(change) =>
                    setForm({ ...form, to: change.target.value, when: 'any' })
                  }
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

      {/*
        One row per category with enough events to fill one. Nothing is fetched for a row that
        will not appear - the facet counts above already said which those are - so on the
        catalogue this ships against these cost no requests at all and render nothing.
      */}
      {browsing && <TrendingRail />}

      {browsing &&
        categories.data?.map((category) => (
          <EventRail
            key={category.slug}
            categorySlug={category.slug}
            title={category.name}
            minimum={RAIL_MINIMUM}
            count={facets.find((facet) => facet.slug === category.slug)?.count ?? 0}
          />
        ))}

      {browsing && facets.some((facet) => facet.count >= RAIL_MINIMUM) && (
        <h2 className="border-b-2 border-ink pb-1 text-label uppercase">Everything on sale</h2>
      )}

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
            {nearlyGone(event) && (
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

/**
 * Whether how many seats are left is news.
 *
 * `seatsTotal` of zero is an Event with nothing on sale at all - every seat withheld - which is
 * not "nearly gone" and would divide by nothing if it were treated as a proportion.
 */
function nearlyGone(event: PublicEventSummary): boolean {
  return event.seatsTotal > 0 && event.seatsAvailable / event.seatsTotal <= NEARLY_GONE
}

/**
 * A filter as a pressed-or-not control.
 *
 * `aria-pressed` rather than a radio group, because these are several independent toggles that
 * happen to look alike - category and city do not exclude one another, and a screen reader
 * told they were one group would be told something untrue about how they behave.
 *
 * Disabled when the count is zero: the chip stays visible so a visitor can see the category
 * exists and that their other filters emptied it, and stays unusable because tapping it would
 * produce an empty listing they did not ask for.
 */
function Chip({
  children,
  pressed,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  pressed: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'min-h-11 border-2 border-ink px-3 text-body',
        pressed ? 'bg-ink text-paper' : 'bg-paper',
        disabled && 'opacity-40',
      )}
    >
      {children}
    </button>
  )
}

/** Three named date ranges, exactly one of which is on. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex" role="group">
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            'min-h-11 border-2 border-ink px-4 text-label uppercase',
            index > 0 && '-ml-0.5',
            value === option.value ? 'bg-ink text-paper' : 'bg-paper',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The applied filters as the two instants the request carries.
 *
 * A named range and a typed one are the same parameters, so they cannot both be on: choosing
 * a tab clears the boxes and typing in a box clears the tab. Merging them would produce an
 * intersection nobody asked for - "this weekend, but also from the 14th" is not a thing
 * anybody means.
 */
function dateRange(applied: Filters): { startsAfter?: string; startsBefore?: string } {
  if (applied.when === 'weekend') {
    return thisWeekend()
  }
  if (applied.when === 'month') {
    return thisMonth()
  }
  return { startsAfter: startOfDay(applied.from), startsBefore: endOfDay(applied.to) }
}

/**
 * The filters currently narrowing the list, as the chips that can remove them.
 *
 * Category and city are shown by name and not by slug: the slug is what the request carries
 * and `tp-ho-chi-minh` is not what anybody pressed.
 */
function countNarrowing(
  applied: Filters,
  categories: { slug: string; name: string }[],
  cities: { slug: string; name: string }[],
): { key: keyof Filters; label: string; clear: Partial<Filters> }[] {
  const chips: { key: keyof Filters; label: string; clear: Partial<Filters> }[] = []
  if (applied.q) {
    chips.push({ key: 'q', label: `“${applied.q}”`, clear: { q: '' } })
  }
  if (applied.categorySlug) {
    const name = categories.find((c) => c.slug === applied.categorySlug)?.name
    chips.push({
      key: 'categorySlug',
      label: name ?? applied.categorySlug,
      clear: { categorySlug: '' },
    })
  }
  if (applied.citySlug) {
    const name = cities.find((c) => c.slug === applied.citySlug)?.name
    chips.push({ key: 'citySlug', label: name ?? applied.citySlug, clear: { citySlug: '' } })
  }
  if (applied.when === 'weekend') {
    chips.push({ key: 'when', label: 'This weekend', clear: { when: 'any' } })
  }
  if (applied.when === 'month') {
    chips.push({ key: 'when', label: 'This month', clear: { when: 'any' } })
  }
  if (applied.from) {
    chips.push({ key: 'from', label: `From ${applied.from}`, clear: { from: '' } })
  }
  if (applied.to) {
    chips.push({ key: 'to', label: `To ${applied.to}`, clear: { to: '' } })
  }
  return chips
}
