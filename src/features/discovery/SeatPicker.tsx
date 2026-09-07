import { useMemo, useState } from 'react'
import type { EventSeat, EventSeatMap, PricingTier } from '~/api/types'
import { formatMoney } from '~/shared/format'
import { Button, Segment, Segmented, cx } from '~/shared/ui'
import {
  boundsAround,
  boundsOf,
  padBounds,
  zoomBounds,
  type Bounds,
} from '~/features/venues/seat-map/geometry'
import { rowNameOf, rowsOf } from '~/features/venues/seat-map/seat-navigation'
import { SeatMapView } from '~/features/venues/seat-map/SeatMapView'
import { TierPatternDefs, tierPaint } from '~/features/venues/seat-map/tier-paint'

/**
 * The hatch and the strike, declared exactly once for the whole page.
 *
 * requirements/004 criterion 2 wants availability *and* Pricing Tier legible at the same
 * time, and DESIGN.md forbids colour as the only signal. At two thousand seats an extra
 * shape each would be four thousand more nodes to build and paint; a `<pattern>` is one
 * paint reference and costs nothing per seat.
 *
 * One declaration, not one per svg: `url(#seat-held)` resolves against the document, so
 * repeating these inside every legend swatch would put a dozen elements with the same id on
 * the page - which is invalid, and resolves to whichever the browser saw first.
 */
function SeatPatternDefs() {
  return (
    <svg aria-hidden className="absolute size-0" focusable="false">
      <defs>
      <pattern
        id="seat-held"
        width={0.3}
        height={0.3}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width={0.3} height={0.3} className="fill-hold" />
        <line x1={0} y1={0} x2={0} y2={0.3} className="stroke-ink" strokeWidth={0.1} />
      </pattern>
      <pattern id="seat-sold" width={0.28} height={0.28} patternUnits="userSpaceOnUse">
        <rect width={0.28} height={0.28} className="fill-paper-sunk" />
        <path d="M0 0 L0.28 0.28 M0.28 0 L0 0.28" className="stroke-ink-soft" strokeWidth={0.07} />
      </pattern>
      </defs>
    </svg>
  )
}

/** Both sets of patterns, so a caller mounts one thing and gets every fill the map can use. */
function SeatAndTierDefs() {
  return (
    <>
      <SeatPatternDefs />
      <TierPatternDefs />
    </>
  )
}

export function SeatPicker({
  map,
  tiers,
  selected,
  onToggle,
  onClear,
}: {
  map: EventSeatMap
  tiers: PricingTier[]
  selected: string[]
  onToggle: (seatId: string) => void
  onClear: () => void
}) {
  const [view, setView] = useState<Bounds | null>(null)
  const [asList, setAsList] = useState(false)

  const contentBounds = useMemo(() => {
    const bounds = boundsOf(map)
    return bounds ? padBounds(bounds, 1) : { minX: -6, minY: -4, maxX: 6, maxY: 4 }
  }, [map])
  const bounds = view ?? contentBounds

  // The tier scale is ordered by first appearance, exactly as the map and the server report
  // it, so the legend's colours match what is drawn.
  const tierOrder = useMemo(() => {
    const names: string[] = []
    for (const seat of map.seats) {
      if (!names.includes(seat.tierName)) {
        names.push(seat.tierName)
      }
    }
    return names
  }, [map.seats])

  const priceOf = (tierName: string) => tiers.find((tier) => tier.name === tierName)?.price
  const paintOf = (tierName: string) => tierPaint(tierOrder.indexOf(tierName))

  const seatClass = (seat: EventSeat) => {
    if (selected.includes(seat.id)) {
      return 'stroke-ink stroke-[0.16] fill-info cursor-pointer'
    }
    switch (seat.availability) {
      case 'AVAILABLE':
        // Coloured by tier, which is what a buyer is choosing between (criterion 2). Past the
        // sixth tier the hue repeats with a dotted overlay, and the fill moves to the
        // attribute below - so this class carries only the stroke for those.
        return cx('stroke-ink cursor-pointer', paintOf(seat.tierName).className)
      case 'HELD':
      case 'SOLD':
        // Fill comes from a pattern; the class carries only the stroke.
        return 'stroke-ink cursor-not-allowed'
      case 'NOT_FOR_SALE':
        return 'stroke-ink-soft fill-transparent cursor-not-allowed'
    }
  }

  const seatFill = (seat: EventSeat) => {
    if (selected.includes(seat.id)) {
      return undefined
    }
    if (seat.availability === 'HELD') {
      return 'url(#seat-held)'
    }
    if (seat.availability === 'SOLD') {
      return 'url(#seat-sold)'
    }
    return paintOf(seat.tierName).fill
  }

  const centre = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }

  const available = map.seats.filter((seat) => seat.availability === 'AVAILABLE').length

  const isChoosable = (seat: EventSeat) =>
    seat.availability === 'AVAILABLE' || selected.includes(seat.id)

  /**
   * Everything about a seat that somebody who cannot see the map needs, in one string.
   *
   * The price is in it rather than only in the legend, because a legend is a second place to
   * go and this is read one seat at a time. The state is a word, which is the same reason the
   * map draws a hatch and a strike rather than relying on colour.
   */
  const describe = (seat: EventSeat) => {
    const price = priceOf(seat.tierName)
    const money = price ? `, ${formatMoney(price)}` : ''
    if (selected.includes(seat.id)) {
      return `${seat.label}, ${seat.tierName}${money}, chosen`
    }
    switch (seat.availability) {
      case 'AVAILABLE':
        return `${seat.label}, ${seat.tierName}${money}, free`
      case 'HELD':
        return `${seat.label}, ${seat.tierName}, being bought by somebody else`
      case 'SOLD':
        return `${seat.label}, ${seat.tierName}, sold`
      case 'NOT_FOR_SALE':
        return `${seat.label}, not for sale`
    }
  }

  return (
    <div className="relative space-y-4">
      <SeatAndTierDefs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-numeric text-numeric text-ink-soft">
          {available} of {map.seats.length} seats free
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {selected.length > 0 && (
            <Button variant="ghost" className="w-auto" onClick={onClear}>
              Clear selection
            </Button>
          )}
          {/* A map is a picture, and a picture is not a way to choose a seat if you cannot
              see one. The list is the same information in the order of the room - and it is
              offered to everybody rather than hidden behind assistive technology, because a
              sighted person hunting for two seats together in row F wants it too. */}
          <Segmented label="How to choose">
            <Segment selected={!asList} onClick={() => setAsList(false)}>
              Map
            </Segment>
            <Segment selected={asList} onClick={() => setAsList(true)}>
              List
            </Segment>
          </Segmented>
          {/* Only with the map. Zoom controls beside a list are three buttons that do
              nothing, and on a 390px screen they were pushing the row off the edge. */}
          {!asList && (
          <Segmented label="Seat map view">
            <Segment
              aria-label="Zoom out"
              title="Zoom out"
              className="w-12 px-0 text-heading"
              onClick={() => setView(zoomBounds(bounds, 1.25, centre, contentBounds))}
            >
              −
            </Segment>
            <Segment
              aria-label="Zoom in"
              title="Zoom in"
              className="w-12 px-0 text-heading"
              onClick={() => setView(zoomBounds(bounds, 0.8, centre, contentBounds))}
            >
              +
            </Segment>
            <Segment title="Fit the whole map in view" onClick={() => setView(null)}>
              Fit
            </Segment>
          </Segmented>
          )}
        </div>
      </div>

      {asList ? (
        <SeatList
          map={map}
          describe={describe}
          choosable={isChoosable}
          selected={selected}
          onToggle={onToggle}
        />
      ) : (
      <div className="border-2 border-ink bg-paper">
        <SeatMapView
          map={map}
          bounds={bounds}
          seatClass={seatClass}
          seatFill={seatFill}
          labelledSeats={map.seats.length <= 200}
          ariaLabel="Choose your seats"
          className="h-[28rem] w-full sm:h-[32rem]"
          onSeatPointerDown={(seat) => {
            if (isChoosable(seat)) {
              onToggle(seat.id)
            }
          }}
          onZoom={(point, factor) => setView(zoomBounds(bounds, factor, point, contentBounds))}
          keyboard={{
            label: describe,
            selected: (seat) => selected.includes(seat.id),
            enabled: isChoosable,
            onActivate: (seat) => onToggle(seat.id),
            // Arrowing to a seat off the edge of a zoomed view moves focus to something
            // nobody can see, which is worse than not moving at all.
            onFocus: (seat) => setView((current) =>
              current ? boundsAround(current, seat, 2) : current),
          }}
        />
      </div>
      )}

      <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {tierOrder.map((name) => {
          const price = priceOf(name)
          return (
            <li key={name} className="flex items-center gap-2 text-body">
              <Swatch {...paintOf(name)} />
              {name}
              {/* Criterion 2: the tier's price is visible, not hidden behind a seat. */}
              {price && <span className="font-numeric text-numeric">{formatMoney(price)}</span>}
            </li>
          )
        })}
        <li className="flex items-center gap-2 text-body text-ink-soft">
          <Swatch fill="url(#seat-held)" />
          Being bought
        </li>
        <li className="flex items-center gap-2 text-body text-ink-soft">
          <Swatch fill="url(#seat-sold)" />
          Sold
        </li>
      </ul>
    </div>
  )
}

/**
 * The map, linearised into the order of the room.
 *
 * Rows top to bottom, seats left to right within each, which is the same order the arrow keys
 * walk - so the two views describe one room rather than two. Unavailable seats are listed and
 * disabled rather than dropped: a gap where A3 should be is how somebody reading this knows
 * that A2 and A4 are not next to each other.
 */
function SeatList({
  map,
  describe,
  choosable,
  selected,
  onToggle,
}: {
  map: EventSeatMap
  describe: (seat: EventSeat) => string
  choosable: (seat: EventSeat) => boolean
  selected: string[]
  onToggle: (seatId: string) => void
}) {
  const rows = useMemo(() => rowsOf(map.seats), [map.seats])

  if (rows.length === 0) {
    return <p className="text-body text-ink-soft">This event has no seats yet.</p>
  }

  return (
    <div className="space-y-6 border-2 border-ink bg-paper p-4">
      {rows.map((row, ordinal) => {
        const seats = row.map((index) => map.seats[index]!)
        const free = seats.filter(choosable).length
        return (
          <section key={ordinal} aria-labelledby={`row-${ordinal}`}>
            <h3 id={`row-${ordinal}`} className="text-label uppercase">
              {rowNameOf(seats.map((seat) => seat.label), ordinal + 1)}
              <span className="ml-3 text-ink-soft">
                {free} of {seats.length} free
              </span>
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {seats.map((seat) => {
                const chosen = selected.includes(seat.id)
                const free = choosable(seat)
                return (
                  <li key={seat.id}>
                    <button
                      type="button"
                      disabled={!free}
                      aria-pressed={chosen}
                      // The full description, not the label: the visible text is a seat
                      // number and on its own it says nothing about price or availability.
                      aria-label={describe(seat)}
                      onClick={() => onToggle(seat.id)}
                      className={cx(
                        'min-h-11 min-w-11 border-2 border-ink px-3 py-2 font-numeric text-numeric',
                        'transition-[transform,box-shadow] duration-[60ms] ease-linear',
                        'motion-reduce:transition-none',
                        chosen
                          ? 'bg-info text-ink shadow-raised'
                          : free
                            ? 'bg-paper text-ink shadow-raised hover:shadow-hover active:translate-x-1 active:translate-y-1 active:shadow-none'
                            // Elevation is the affordance, here as everywhere: a seat nobody
                            // can take loses its shadow and keeps its contrast.
                            : 'cursor-not-allowed bg-paper-sunk text-ink shadow-none',
                      )}
                    >
                      {seat.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** A legend swatch drawn the same way a seat is, so the two cannot drift apart. */
function Swatch({ className, fill }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 1 1" className="size-4 shrink-0" aria-hidden>
      <circle
        cx={0.5}
        cy={0.5}
        r={0.42}
        strokeWidth={0.1}
        fill={fill}
        className={cx('stroke-ink', className)}
      />
    </svg>
  )
}
