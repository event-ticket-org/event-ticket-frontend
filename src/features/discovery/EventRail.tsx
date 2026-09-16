import { Link } from 'react-router'
import type { PublicEventSummary } from '~/api/types'
import { formatInZone, formatMoney } from '~/shared/format'
import { CoverImage, cx } from '~/shared/ui'
import { useCategoryRail } from './public-hooks'

/**
 * A horizontal row of events in one category.
 *
 * Two things make this different from the listing below it, and both are consequences of the
 * row being horizontal rather than of it being a row.
 *
 * **The card is sparser.** A rail card is read at a glance while somebody scrolls past it, so
 * it carries the four things that decide whether to stop: the picture, the title, the date and
 * what it costs. The listing card keeps venue, city and organizer because it is a full-width
 * block with room for them - the same information in a rail card would be four lines of grey
 * text nobody reads sideways.
 *
 * **It can decline to appear.** requirements/009 criterion 16: a row too short to look like a
 * selection is not shown at all. The listing degrades by having fewer kinds of thing above it,
 * never by having an empty one - and the decision is here rather than in the caller so that
 * every rail makes it the same way.
 */

/** Cards fetched for a rail. More than fit on a wide screen, so scrolling it has somewhere to go. */
const RAIL_SIZE = 12

export function EventRail({
  categorySlug,
  title,
  minimum,
  count,
}: {
  categorySlug: string
  title: string
  /** Below this the row does not render. */
  minimum: number
  /** What the listing's facets said this category holds, which is what decides the fetch. */
  count: number
}) {
  // The facet count has already answered "is this row worth drawing", so a row that will not
  // appear never asks the server for its contents. On a catalogue of ten events that is six
  // requests not made.
  const events = useCategoryRail(categorySlug, RAIL_SIZE, count >= minimum)
  const rows = events.data?.items ?? []

  if (count < minimum || rows.length < minimum) {
    return null
  }

  return (
    <Rail title={title} seeAll={`/?categorySlug=${categorySlug}`}>
      {rows.map((event) => (
        <li key={event.id} className="w-64 shrink-0 snap-start">
          <RailCard event={event} />
        </li>
      ))}
    </Rail>
  )
}

/**
 * The row itself: a heading, an optional way to see the rest, and a horizontal scroller.
 *
 * Shared by the category rails and the ranked one so the three rows on the page are the same
 * object rather than three that look alike - the failure being avoided is one rail with
 * different card spacing or a heading a size out, which reads as a rendering bug.
 */
export function Rail({
  title,
  seeAll,
  children,
}: {
  title: React.ReactNode
  seeAll?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-1">
        <h2 className="text-heading">{title}</h2>
        {seeAll && (
          <Link to={seeAll} className="text-label uppercase">
            See all
          </Link>
        )}
      </div>
      {/*
        A scrolling row rather than a wrapping grid. A grid of four would reflow into two rows
        on a narrow screen and stop being a rail; this stays one row at every width and the
        overflow is the affordance. `-mx-4 px-4` lets the first and last cards sit flush with
        the page's edge while still having room to breathe when scrolled.
      */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
        {children}
      </ul>
    </section>
  )
}

/**
 * The compact card: picture, title, when, from how much.
 *
 * Sold out still says so, which Ticketbox's equivalent does not. An event a reader cannot buy
 * is the one thing worth knowing before they tap, and leaving it to the event page means a
 * navigation to learn it.
 */
export function RailCard({ event, rank }: { event: PublicEventSummary; rank?: number }) {
  const soldOut = event.seatsAvailable === 0

  return (
    <Link
      to={`/events/${event.id}`}
      className={cx(
        'flex h-full flex-col border-2 border-ink bg-paper shadow-raised',
        'transition-[transform,box-shadow] duration-[60ms] ease-linear',
        'hover:shadow-hover active:translate-x-1 active:translate-y-1 active:shadow-none',
        'motion-reduce:transition-none',
      )}
    >
      <CoverImage
        src={event.coverImageUrl}
        alt={event.coverImageAlt}
        sizes={event.coverImageSizes}
        shape="band"
        className="border-0 border-b-2"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-baseline gap-3">
          {/*
            The rank, at display size, beside the title rather than floating over the cover.
            Ticketbox sets huge numerals half-behind the artwork; here the cover is a hard-edged
            block with a 2px border and a numeral crossing it would fight the border rather than
            sit in front of it. Same information, in the system's own grammar.

            aria-hidden because the list order already says it, and a screen reader that read
            "1 Live in Saigon, 2 Jazz at the Opera House" would be reading the numbering twice.
          */}
          {rank !== undefined && (
            <span aria-hidden="true" className="font-numeric text-display leading-none">
              {rank}
            </span>
          )}
          <h3 className="text-body-strong">{event.title}</h3>
        </div>
        {/* The venue's clock, like every time on this site. Date only: a rail is about which
            day, and the hour is on the page a tap away. */}
        <p className="text-body text-ink-soft">
          {formatInZone(event.startsAt, event.timezone, { dateStyle: 'medium', timeStyle: undefined })}
        </p>
        <div className="mt-auto">
          {soldOut ? (
            <span className="inline-block border-2 border-ink bg-paper-sunk px-2 py-0.5 text-label uppercase">
              Sold out
            </span>
          ) : event.priceFrom ? (
            <span className="text-body">
              from <span className="font-numeric text-numeric-lg">{formatMoney(event.priceFrom)}</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
