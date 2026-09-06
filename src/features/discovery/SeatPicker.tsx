import { useMemo, useState } from 'react'
import type { EventSeat, EventSeatMap, PricingTier } from '~/api/types'
import { formatMoney } from '~/shared/format'
import { Button, Segment, Segmented, cx } from '~/shared/ui'
import {
  boundsOf,
  padBounds,
  zoomBounds,
  type Bounds,
} from '~/features/venues/seat-map/geometry'
import { SeatMapView } from '~/features/venues/seat-map/SeatMapView'

const TIER_FILLS = [
  'fill-tier-1',
  'fill-tier-2',
  'fill-tier-3',
  'fill-tier-4',
  'fill-tier-5',
  'fill-tier-6',
]

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
  const tierFill = (tierName: string) =>
    TIER_FILLS[tierOrder.indexOf(tierName) % TIER_FILLS.length] ?? 'fill-paper-sunk'

  const seatClass = (seat: EventSeat) => {
    if (selected.includes(seat.id)) {
      return 'stroke-ink stroke-[0.16] fill-info cursor-pointer'
    }
    switch (seat.availability) {
      case 'AVAILABLE':
        // Coloured by tier, which is what a buyer is choosing between (criterion 2).
        return cx('stroke-ink cursor-pointer', tierFill(seat.tierName))
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
    return undefined
  }

  const centre = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }

  const available = map.seats.filter((seat) => seat.availability === 'AVAILABLE').length

  return (
    <div className="relative space-y-4">
      <SeatPatternDefs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-numeric text-numeric text-ink-soft">
          {available} of {map.seats.length} seats free
        </p>
        <div className="flex items-center gap-3">
          {selected.length > 0 && (
            <Button variant="ghost" className="w-auto" onClick={onClear}>
              Clear selection
            </Button>
          )}
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
        </div>
      </div>

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
            if (seat.availability === 'AVAILABLE' || selected.includes(seat.id)) {
              onToggle(seat.id)
            }
          }}
          onZoom={(point, factor) => setView(zoomBounds(bounds, factor, point, contentBounds))}
        />
      </div>

      <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {tierOrder.map((name) => {
          const price = priceOf(name)
          return (
            <li key={name} className="flex items-center gap-2 text-body">
              <Swatch className={tierFill(name)} />
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
