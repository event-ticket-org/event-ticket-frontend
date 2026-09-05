import type { MapElement, SeatMap, SeatMapSeat } from '~/api/types'

/**
 * Seat map coordinates are abstract.
 *
 * The contract says only `number` for `x` and `y`, so nothing fixes a unit: the generator's
 * default gap is 1, which makes one unit roughly one seat pitch, and everything else follows
 * from fitting the content to whatever box it is drawn in. That is what lets the same
 * component serve the editor at 900px and a buyer's phone at 375px without a second layout.
 *
 * The fitting itself is SVG's `viewBox` rather than arithmetic of ours - it already keeps the
 * aspect ratio and centres the remainder, and `getScreenCTM()` inverts a pointer back into
 * these coordinates. Hand-rolling either would be code to maintain and get wrong.
 */

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

/** Half a seat's pitch, so a seat at the very edge is not clipped in half. */
export const SEAT_RADIUS = 0.42

export function boundsOf(map: Pick<SeatMap, 'seats' | 'elements'>): Bounds | null {
  const xs: number[] = []
  const ys: number[] = []

  for (const seat of map.seats) {
    xs.push(seat.x - SEAT_RADIUS, seat.x + SEAT_RADIUS)
    ys.push(seat.y - SEAT_RADIUS, seat.y + SEAT_RADIUS)
  }
  for (const element of map.elements) {
    const { width, height } = elementSize(element)
    xs.push(element.x, element.x + width)
    ys.push(element.y, element.y + height)
  }
  if (xs.length === 0 || ys.length === 0) {
    return null
  }
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

export function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  }
}

/**
 * A `viewBox` never has zero width or height. A one-seat map, or a row with no depth, would
 * otherwise divide by zero inside the browser and render nothing at all - which looks exactly
 * like a broken component rather than like a map with one seat on it.
 */
export function viewBoxOf(bounds: Bounds): string {
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  return `${bounds.minX} ${bounds.minY} ${width} ${height}`
}

/** Zooms about a point, so the thing under the cursor stays under the cursor. */
export function zoomBounds(
  bounds: Bounds,
  factor: number,
  about: { x: number; y: number },
): Bounds {
  return {
    minX: about.x + (bounds.minX - about.x) * factor,
    maxX: about.x + (bounds.maxX - about.x) * factor,
    minY: about.y + (bounds.minY - about.y) * factor,
    maxY: about.y + (bounds.maxY - about.y) * factor,
  }
}

export function panBounds(bounds: Bounds, dx: number, dy: number): Bounds {
  return {
    minX: bounds.minX + dx,
    maxX: bounds.maxX + dx,
    minY: bounds.minY + dy,
    maxY: bounds.maxY + dy,
  }
}

export type Rect = { x: number; y: number; width: number; height: number }

/** Normalises a drag into a rectangle, so a marquee works in all four directions. */
export function rectBetween(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

export function seatsWithin(seats: SeatMapSeat[], rect: Rect): SeatMapSeat[] {
  return seats.filter(
    (seat) =>
      seat.x >= rect.x &&
      seat.x <= rect.x + rect.width &&
      seat.y >= rect.y &&
      seat.y <= rect.y + rect.height,
  )
}

/** Defaults sized for what these depict: a stage is wide and shallow, a label is small. */
export function elementSize(element: MapElement): { width: number; height: number } {
  return { width: element.width ?? 6, height: element.height ?? 1.5 }
}
