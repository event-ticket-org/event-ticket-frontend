import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MapElement, SeatMap, SeatMapSeat } from '~/api/types'
import { cx } from '~/shared/ui'
import { SEAT_RADIUS, elementSize, viewBoxOf, type Bounds, type Rect } from './geometry'
import { directionFor, rowsOf, step } from './seat-navigation'

/**
 * One renderer, three jobs: the editor here, the venue page's read-only view, and the buyer's
 * seat picker in slice 3. Which is why it knows nothing about selection *meaning* - it is
 * handed a class per seat and reports pointers back in map coordinates.
 *
 * `nfr.md` puts 2,000 seats on an Event, so: one `<g>`, no per-seat React state, and no
 * per-seat handler. Events are delegated from the root and the seat is resolved from a data
 * attribute, which keeps a full re-render to one pass over a flat array.
 */

/**
 * Generic over the seat, because the two callers hold different ones: the editor edits
 * `SeatMapSeat`, and the buyer's picker needs an `EventSeat` - which adds the id it checks
 * out with and the availability it colours by. Without this the picker would get its own
 * seats back typed as the editor's and have to look each one up again by index.
 */
export type SeatMapViewProps<S extends SeatMapSeat> = {
  map: { seats: S[]; elements: SeatMap['elements'] }
  bounds: Bounds
  /** Tailwind classes for a seat's fill and stroke. */
  seatClass: (seat: S, index: number) => string
  /**
   * A paint reference for seats whose fill is a `<pattern>` rather than a colour - the hatch
   * on a held seat, the strike on a sold one. Returning undefined leaves the class to it.
   */
  seatFill?: (seat: S, index: number) => string | undefined
  /** Patterns and gradients this map's fills refer to. Declared once, not per seat. */
  defs?: React.ReactNode
  labelledSeats?: boolean
  marquee?: Rect | null
  onSeatPointerDown?: (seat: S, index: number, event: React.PointerEvent) => void
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
  /**
   * Zoom, and only when the pointer asks for it — see the listener below. A factor under 1
   * zooms in.
   */
  onZoom?: (point: { x: number; y: number }, factor: number) => void
  className?: string
  ariaLabel: string
  /**
   * Supplied when the map is something to choose from rather than a picture of one.
   *
   * Without it the `<svg>` stays a single labelled image: correct for the venue page's
   * read-only view, and useless anywhere a person has to pick a seat. With it the seats become
   * a listbox with one tab stop and spatial arrow keys - see `seat-navigation.ts` for why the
   * arrows follow the room rather than the array.
   */
  keyboard?: {
    /** Everything about a seat that somebody who cannot see the map needs, in one string. */
    label: (seat: S, index: number) => string
    selected?: (seat: S, index: number) => boolean
    /** False for a seat nobody can choose. It stays reachable, and says why in its label. */
    enabled?: (seat: S, index: number) => boolean
    onActivate: (seat: S, index: number, event: React.KeyboardEvent) => void
    /**
     * Extend a selection from where it started to where focus has just moved.
     *
     * Two seat indices, and no opinion about what lies between them - this component knows
     * where seats are, and the caller knows what selecting means. `rangeRect` is what turns
     * the pair into the box a pointer's marquee would have drawn around them.
     *
     * Supplied only by a caller that can select more than one seat at a time. Without it,
     * Shift and an arrow is an arrow.
     */
    onExtend?: (anchor: number, focus: number) => void
    /** The platform's select-all, for a caller that has something to do with all of them. */
    onSelectAll?: () => void
    /** Told where focus went, so a zoomed caller can bring it into view. */
    onFocus?: (seat: S, index: number) => void
    /**
     * First refusal on every key, for a caller with a vocabulary of its own.
     *
     * Returning true stops the default handling, which is how the editor takes the arrows
     * while a selection is being moved: this component knows about seats and rows and has no
     * business knowing what "moving" is.
     */
    onKeyDown?: (event: React.KeyboardEvent, index: number) => boolean
  }
}

export function SeatMapView<S extends SeatMapSeat>({
  map,
  bounds,
  seatClass,
  seatFill,
  defs,
  labelledSeats = false,
  marquee,
  onSeatPointerDown,
  onElementPointerDown,
  selectedElement = null,
  onBackgroundPointerDown,
  onPointerMove,
  onPointerUp,
  onZoom,
  className,
  ariaLabel,
  keyboard,
}: SeatMapViewProps<S>) {
  const svg = useRef<SVGSVGElement>(null)

  /**
   * The one seat in the tab order (the roving tabindex pattern). Tab reaches the map once and
   * the arrows move within it; two thousand tab stops would be a worse map than no map.
   *
   * It starts on the first seat somebody can actually choose, because landing on a sold seat
   * and having to hunt for a free one is the map's whole failure mode repeated by keyboard.
   */
  const [focused, setFocused] = useState(0)
  const rows = useMemo(
    () => (keyboard ? rowsOf(map.seats) : []),
    [keyboard, map.seats],
  )
  const firstChoosable = useMemo(() => {
    if (!keyboard?.enabled) {
      return 0
    }
    const index = map.seats.findIndex((seat, at) => keyboard.enabled!(seat, at))
    return index === -1 ? 0 : index
  }, [keyboard, map.seats])

  // Clamped rather than reset: a map that shrinks under a held focus should keep it somewhere
  // real, and a caller re-rendering with new availability must not throw the position away.
  const roving = Math.min(focused || firstChoosable, Math.max(map.seats.length - 1, 0))

  /**
   * Where the current selection started, which is what Shift extends *from*.
   *
   * A ref: it changes with every unshifted move and nothing renders from it, and a selection
   * whose anchor lagged a render behind would extend from the seat before the one somebody
   * chose. Null until anybody has chosen anything, at which point the focused seat is as good
   * a start as there is.
   */
  const anchor = useRef<number | null>(null)

  const moveTo = (index: number) => {
    if (index === roving) {
      return
    }
    setFocused(index)
    const seat = map.seats[index]
    if (seat) {
      keyboard?.onFocus?.(seat, index)
    }
    // Imperative, because the element that should hold focus is the one React is about to
    // render - and asking for it after the paint is a frame of focus on nothing.
    requestAnimationFrame(() => {
      svg.current?.querySelector<SVGCircleElement>(`[data-seat="${index}"]`)?.focus()
    })
  }

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

  /**
   * Plain wheel scrolls the page. Ctrl or Cmd zooms — which is also what a trackpad pinch
   * sends, so pinch-to-zoom works without being special-cased.
   *
   * A React `onWheel` is registered passive, so it cannot stop the page scrolling: the map
   * zoomed *and* the page moved, and on a screen shorter than this page you could not scroll
   * past the map to reach Save. Hence a non-passive listener, and hence requiring the
   * modifier — a map embedded in a document must not swallow the document's scroll.
   */
  useEffect(() => {
    const element = svg.current
    if (!element || !onZoom) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return
      }
      event.preventDefault()
      onZoom(toMapPoint(event), event.deltaY > 0 ? 1.1 : 0.9)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [onZoom, toMapPoint])

  return (
    <svg
      ref={svg}
      // A picture of a room when nobody can choose from it, and nothing at all when they can:
      // an image cannot contain options, and the listbox below carries the name instead.
      role={keyboard ? 'presentation' : 'img'}
      aria-label={keyboard ? undefined : ariaLabel}
      viewBox={viewBoxOf(bounds)}
      preserveAspectRatio="xMidYMid meet"
      className={cx('touch-pan-y select-none', className)}
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
    >
      {defs && <defs>{defs}</defs>}

      {map.elements.map((element, index) => (
        <Element
          key={index}
          index={index}
          element={element}
          interactive={onElementPointerDown !== undefined}
          selected={selectedElement === index}
        />
      ))}

      <g
        role={keyboard ? 'listbox' : undefined}
        aria-multiselectable={keyboard ? true : undefined}
        aria-label={keyboard ? ariaLabel : undefined}
        // One handler for the whole map rather than one per seat: keydown bubbles, and two
        // thousand listeners is the thing this component is built not to do.
        onKeyDown={
          keyboard
            ? (event) => {
                // The seat that actually has focus, read off the element, not the state that
                // mirrors it. Focus also arrives by click and by Tab returning to the map, and
                // in the same tick as either of those the mirrored index is still the old one -
                // which chooses whichever seat was last arrowed to instead of this one.
                const found = seatAt(
                  (event.target as Element).closest('[data-seat]')?.getAttribute('data-seat'),
                )
                const [, from] = found ?? [undefined, roving]

                if (keyboard.onKeyDown?.(event, from)) {
                  return
                }

                if (event.key === 'Enter' || event.key === ' ') {
                  const seat = map.seats[from]
                  if (seat && (keyboard.enabled?.(seat, from) ?? true)) {
                    event.preventDefault()
                    // Choosing a seat is where a selection starts, so it is where the next
                    // Shift will extend from.
                    anchor.current = from
                    keyboard.onActivate(seat, from, event)
                  }
                  return
                }

                if ((event.metaKey || event.ctrlKey) && (event.key === 'a' || event.key === 'A')) {
                  if (keyboard.onSelectAll) {
                    event.preventDefault()
                    keyboard.onSelectAll()
                  }
                  return
                }
                const direction = event.ctrlKey || event.metaKey
                  ? (event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : undefined)
                  : directionFor(event.key)
                if (!direction) {
                  return
                }
                // Only once the map has claimed the key. An arrow the map ignores is an arrow
                // that still scrolls the page, which is what somebody expects it to do.
                event.preventDefault()
                const next = step(map.seats, rows, from, direction)

                // Shift extends; a bare arrow moves and takes the anchor with it. The same two
                // rules every listbox has, which is the point - this is not a gesture worth
                // inventing a vocabulary for.
                if (event.shiftKey && keyboard.onExtend) {
                  anchor.current ??= from
                  moveTo(next)
                  keyboard.onExtend(anchor.current, next)
                  return
                }
                anchor.current = next
                moveTo(next)
              }
            : undefined
        }
      >
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
            fill={seatFill?.(seat, index)}
            className={cx(
              seatClass(seat, index),
              // The ring is drawn below, in map units. An outline on an SVG shape is
              // unreliable across browsers and would not scale with the map if it were.
              keyboard && 'outline-none',
            )}
            role={keyboard ? 'option' : undefined}
            tabIndex={keyboard ? (index === roving ? 0 : -1) : undefined}
            aria-label={keyboard?.label(seat, index)}
            aria-selected={keyboard ? (keyboard.selected?.(seat, index) ?? false) : undefined}
            aria-disabled={
              keyboard && keyboard.enabled && !keyboard.enabled(seat, index) ? true : undefined
            }
            onFocus={keyboard ? () => setFocused(index) : undefined}
          />
        ))}
      </g>

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

      {/* Drawn, not outlined: in map units it scales with the zoom and it renders the same in
          every browser, neither of which is true of an outline on an SVG shape. Two rings,
          because {colors.info} on a tier fill of similar lightness is a ring nobody sees -
          the ink one underneath is what guarantees it against any of the six. */}
      {keyboard && map.seats[roving] && (
        <g className="pointer-events-none">
          <circle
            cx={map.seats[roving]!.x}
            cy={map.seats[roving]!.y}
            r={SEAT_RADIUS + 0.26}
            fill="none"
            className="stroke-ink"
            strokeWidth={0.2}
          />
          <circle
            cx={map.seats[roving]!.x}
            cy={map.seats[roving]!.y}
            r={SEAT_RADIUS + 0.26}
            fill="none"
            className="stroke-info"
            strokeWidth={0.12}
          />
        </g>
      )}

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
      className={interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}
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
