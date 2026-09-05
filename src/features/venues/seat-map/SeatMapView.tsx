import { useCallback, useRef } from 'react'
import type { MapElement, SeatMap, SeatMapSeat } from '~/api/types'
import { cx } from '~/shared/ui'
import { SEAT_RADIUS, elementSize, viewBoxOf, type Bounds, type Rect } from './geometry'

/**
 * One renderer, three jobs: the editor here, the venue page's read-only view, and the buyer's
 * seat picker in slice 3. Which is why it knows nothing about selection *meaning* - it is
 * handed a class per seat and reports pointers back in map coordinates.
 *
 * `nfr.md` puts 2,000 seats on an Event, so: one `<g>`, no per-seat React state, and no
 * per-seat handler. Events are delegated from the root and the seat is resolved from a data
 * attribute, which keeps a full re-render to one pass over a flat array.
 */

export type SeatMapViewProps = {
  map: SeatMap
  bounds: Bounds
  /** Tailwind classes for a seat's fill and stroke. */
  seatClass: (seat: SeatMapSeat, index: number) => string
  labelledSeats?: boolean
  marquee?: Rect | null
  onSeatPointerDown?: (seat: SeatMapSeat, index: number, event: React.PointerEvent) => void
  onBackgroundPointerDown?: (point: { x: number; y: number }, event: React.PointerEvent) => void
  onPointerMove?: (point: { x: number; y: number }, event: React.PointerEvent) => void
  onPointerUp?: (point: { x: number; y: number }, event: React.PointerEvent) => void
  onWheel?: (point: { x: number; y: number }, event: React.WheelEvent) => void
  className?: string
  ariaLabel: string
}

export function SeatMapView({
  map,
  bounds,
  seatClass,
  labelledSeats = false,
  marquee,
  onSeatPointerDown,
  onBackgroundPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  className,
  ariaLabel,
}: SeatMapViewProps) {
  const svg = useRef<SVGSVGElement>(null)

  /**
   * Screen to map coordinates, through the browser's own matrix.
   *
   * `getScreenCTM()` already accounts for the viewBox, the element's size and any CSS
   * transform on an ancestor. Recomputing that by hand is how a seat map ends up selecting
   * the seat next to the one you clicked on a scrolled page.
   */
  const toMapPoint = useCallback((event: { clientX: number; clientY: number }) => {
    const element = svg.current
    const matrix = element?.getScreenCTM()
    if (!element || !matrix) {
      return { x: 0, y: 0 }
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: point.x, y: point.y }
  }, [])

  /**
   * Seats are identified by their position in the array, not by their label.
   *
   * A label is unique in a *valid* map, and the editor's whole job is the interval where it
   * is not: rename B1 to A1 and label-based identity selects both, moves both, and renames
   * both - so a duplicate becomes impossible to repair without discarding the draft. It also
   * hands React two children with the same key.
   */
  const seatAt = (attribute: string | null | undefined) => {
    const index = attribute === null || attribute === undefined ? -1 : Number(attribute)
    const seat = map.seats[index]
    return seat ? ([seat, index] as const) : undefined
  }

  return (
    <svg
      ref={svg}
      role="img"
      aria-label={ariaLabel}
      viewBox={viewBoxOf(bounds)}
      preserveAspectRatio="xMidYMid meet"
      className={cx('touch-none select-none', className)}
      onPointerDown={(event) => {
        const found = seatAt(
          (event.target as Element).closest('[data-seat]')?.getAttribute('data-seat'),
        )
        if (found) {
          onSeatPointerDown?.(found[0], found[1], event)
        } else {
          onBackgroundPointerDown?.(toMapPoint(event), event)
        }
      }}
      onPointerMove={(event) => onPointerMove?.(toMapPoint(event), event)}
      onPointerUp={(event) => onPointerUp?.(toMapPoint(event), event)}
      onWheel={(event) => onWheel?.(toMapPoint(event), event)}
    >
      {map.elements.map((element, index) => (
        <Element key={`${element.kind}-${index}`} element={element} />
      ))}

      {map.seats.map((seat, index) => (
        <circle
          key={index}
          data-seat={index}
          cx={seat.x}
          cy={seat.y}
          r={SEAT_RADIUS}
          // Stroke width is in map units, so it thins as you zoom out and the map stays
          // legible instead of turning into a field of outlines.
          strokeWidth={0.08}
          className={seatClass(seat, index)}
        />
      ))}

      {labelledSeats &&
        map.seats.map((seat, index) => (
          <text
            key={`label-${index}`}
            x={seat.x}
            y={seat.y + 0.12}
            textAnchor="middle"
            fontSize={0.34}
            className="pointer-events-none fill-ink font-numeric"
          >
            {seat.label}
          </text>
        ))}

      {marquee && (
        <rect
          x={marquee.x}
          y={marquee.y}
          width={marquee.width}
          height={marquee.height}
          className="pointer-events-none fill-info/20 stroke-ink"
          strokeWidth={0.06}
          strokeDasharray="0.3 0.2"
        />
      )}
    </svg>
  )
}

/**
 * Never ticketed, and never selectable. A stage or an aisle exists so a buyer can orient
 * themselves, so it must not look like something to click.
 */
function Element({ element }: { element: MapElement }) {
  const { width, height } = elementSize(element)
  return (
    <g className="pointer-events-none">
      <rect
        x={element.x}
        y={element.y}
        width={width}
        height={height}
        className="fill-paper-sunk stroke-ink"
        strokeWidth={0.08}
      />
      <text
        x={element.x + width / 2}
        y={element.y + height / 2 + 0.14}
        textAnchor="middle"
        fontSize={0.42}
        className="fill-ink-soft uppercase"
        letterSpacing={0.06}
      >
        {element.label ?? element.kind}
      </text>
    </g>
  )
}
