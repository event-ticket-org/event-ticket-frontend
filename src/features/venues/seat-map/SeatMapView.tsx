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
  /**
   * Supplied only by the editor. A landmark is never ticketed, so in the buyer's view it must
   * not look or behave like something to click - without this it stays inert, which is the
   * default deliberately.
   */
  onElementPointerDown?: (
    element: MapElement,
    index: number,
    point: { x: number; y: number },
    event: React.PointerEvent,
  ) => void
  selectedElement?: number | null
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
  onElementPointerDown,
  selectedElement = null,
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
        const target = event.target as Element
        const found = seatAt(target.closest('[data-seat]')?.getAttribute('data-seat'))
        if (found) {
          onSeatPointerDown?.(found[0], found[1], event)
          return
        }
        const elementIndex = target.closest('[data-element]')?.getAttribute('data-element')
        const element = elementIndex === null || elementIndex === undefined
          ? undefined
          : map.elements[Number(elementIndex)]
        if (element) {
          onElementPointerDown?.(element, Number(elementIndex), toMapPoint(event), event)
          return
        }
        onBackgroundPointerDown?.(toMapPoint(event), event)
      }}
      onPointerMove={(event) => onPointerMove?.(toMapPoint(event), event)}
      onPointerUp={(event) => onPointerUp?.(toMapPoint(event), event)}
      onWheel={(event) => onWheel?.(toMapPoint(event), event)}
    >
      {map.elements.map((element, index) => (
        <Element
          key={index}
          index={index}
          element={element}
          interactive={onElementPointerDown !== undefined}
          selected={selectedElement === index}
        />
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
 * Never ticketed. A stage or an aisle exists so a buyer can orient themselves, so outside the
 * editor it is inert and must not look like something to click.
 */
function Element({
  element,
  index,
  interactive,
  selected,
}: {
  element: MapElement
  index: number
  interactive: boolean
  selected: boolean
}) {
  const { width, height } = elementSize(element)
  return (
    <g
      data-element={interactive ? index : undefined}
      className={interactive ? 'cursor-move' : 'pointer-events-none'}
    >
      <rect
        x={element.x}
        y={element.y}
        width={width}
        height={height}
        className={cx('stroke-ink', selected ? 'fill-info' : 'fill-paper-sunk')}
        strokeWidth={selected ? 0.16 : 0.08}
      />
      <text
        x={element.x + width / 2}
        y={element.y + height / 2 + 0.14}
        textAnchor="middle"
        fontSize={0.42}
        // ink, not ink-soft: this sits on paper-sunk at rest and on info when selected,
        // which are 6.6:1 and 4.2:1 - the palette's forbidden pair and worse. The class
        // rule cannot see this one, since the fill and its background are two elements.
        className="fill-ink uppercase"
        letterSpacing={0.06}
      >
        {element.label ?? element.kind}
      </text>
    </g>
  )
}
