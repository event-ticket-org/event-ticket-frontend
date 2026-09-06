import type { SeatMapSeat } from '~/api/types'
import { SEAT_RADIUS, type Rect } from './geometry'

/**
 * Moving around a seat map without a pointer.
 *
 * A seat map is a picture of a room, and the only navigation that makes sense in one is
 * spatial: left and right along a row, up and down between rows. Tab order would walk the
 * array, which is the order the seats were generated in and means nothing to somebody sitting
 * in the room - and at two thousand seats, "press Tab two hundred times" is not access.
 *
 * Rows are found from the coordinates rather than from the labels. A label is free text a
 * venue chose (`A12`, `Balcony 3`, `12`), and parsing it would work until the first venue that
 * numbers its rows differently; `y` is where the seat actually is.
 */

/** Half a row's pitch. Seats generated in a row share a `y` exactly; dragged ones drift. */
const ROW_TOLERANCE = 0.5

export type Direction = 'left' | 'right' | 'up' | 'down' | 'rowStart' | 'rowEnd' | 'first' | 'last'

/**
 * Seat indices grouped into rows, top to bottom, each ordered left to right.
 *
 * Indices rather than seats, because a seat is identified by its position in the array
 * everywhere else in this feature and a second identity would be a second thing to keep in
 * step.
 */
export function rowsOf(seats: readonly SeatMapSeat[]): number[][] {
  const byRow: { y: number; indices: number[] }[] = []

  seats.forEach((seat, index) => {
    // Nearest existing row within half a pitch, not the first within it: two rows closer
    // together than the tolerance would otherwise swallow each other in array order.
    let nearest: { y: number; indices: number[] } | undefined
    let nearestGap = ROW_TOLERANCE
    for (const row of byRow) {
      const gap = Math.abs(row.y - seat.y)
      if (gap <= nearestGap) {
        nearest = row
        nearestGap = gap
      }
    }
    if (nearest) {
      nearest.indices.push(index)
    } else {
      byRow.push({ y: seat.y, indices: [index] })
    }
  })

  return byRow
    .sort((a, b) => a.y - b.y)
    .map((row) => row.indices.sort((a, b) => seats[a]!.x - seats[b]!.x))
}

/**
 * Where a key press lands, as an index into the seats array.
 *
 * Returns the seat it started from when there is nowhere to go, so a caller never has to
 * handle "no move" separately and focus never falls off the edge of the map.
 *
 * Up and down land on the seat *nearest in x*, not on the same position in the next row. Rows
 * are not the same length - a balcony is narrower than the stalls - and counting along would
 * send somebody sideways across the room, which is exactly the thing a spatial map is for
 * avoiding.
 */
export function step(
  seats: readonly SeatMapSeat[],
  rows: readonly number[][],
  from: number,
  direction: Direction,
): number {
  const rowIndex = rows.findIndex((row) => row.includes(from))
  const row = rows[rowIndex]
  if (!row) {
    return from
  }
  const position = row.indexOf(from)

  switch (direction) {
    case 'left':
      return row[position - 1] ?? from
    case 'right':
      return row[position + 1] ?? from
    case 'rowStart':
      return row[0] ?? from
    case 'rowEnd':
      return row[row.length - 1] ?? from
    case 'first':
      return rows[0]?.[0] ?? from
    case 'last': {
      const lastRow = rows[rows.length - 1]
      return lastRow?.[lastRow.length - 1] ?? from
    }
    case 'up':
    case 'down': {
      const target = rows[rowIndex + (direction === 'up' ? -1 : 1)]
      return target ? nearestInRow(seats, target, seats[from]!.x) : from
    }
  }
}

function nearestInRow(seats: readonly SeatMapSeat[], row: readonly number[], x: number): number {
  let best = row[0]!
  let bestGap = Math.abs(seats[best]!.x - x)
  for (const index of row) {
    const gap = Math.abs(seats[index]!.x - x)
    if (gap < bestGap) {
      best = index
      bestGap = gap
    }
  }
  return best
}

/**
 * What to call a row, taken from the seats in it.
 *
 * A row has no name in the data - only its seats do - and a venue's own naming is the one a
 * person in the building will hear called out. `A1, A2, A3` is row A; `Balcony 1, Balcony 2`
 * is the balcony. When the labels share nothing, the position from the front is all there is,
 * and inventing a letter for it would be inventing a name the venue does not use.
 */
export function rowNameOf(labels: readonly string[], ordinal: number): string {
  const first = labels[0] ?? ''
  let shared = first.length
  for (const label of labels) {
    let i = 0
    while (i < shared && i < label.length && label[i] === first[i]) {
      i += 1
    }
    shared = i
  }
  // Trailing separators and spaces belong to the seat, not to the row's name.
  const prefix = first.slice(0, shared).replace(/[\s\-_]+$/, '')
  return prefix === '' ? `Row ${ordinal}` : `Row ${prefix}`
}

/**
 * What "everything between these two seats" means when the two seats are in a room.
 *
 * A rectangle, not a run through the array. Array order is the order seats were generated in,
 * so extending a selection along it would sweep up whichever seats happened to be made next -
 * which in a ragged map is a diagonal nobody drew. The rectangle two seats bound is what a
 * pointer's marquee would have produced around them, and matching it is the whole point: there
 * is one selection gesture here with two ways to perform it, not two gestures.
 *
 * Padded by a seat's radius, so the box is around the two seats rather than between their
 * centres. Without it a run along one row is a rectangle of zero height, and a row-mate nudged
 * a quarter pitch off the line falls outside a selection it is visibly inside.
 */
export function rangeRect(
  seats: readonly SeatMapSeat[],
  anchor: number,
  focus: number,
): Rect | undefined {
  const from = seats[anchor]
  const to = seats[focus]
  if (!from || !to) {
    return undefined
  }
  const minX = Math.min(from.x, to.x) - SEAT_RADIUS
  const minY = Math.min(from.y, to.y) - SEAT_RADIUS
  return {
    x: minX,
    y: minY,
    width: Math.max(from.x, to.x) + SEAT_RADIUS - minX,
    height: Math.max(from.y, to.y) + SEAT_RADIUS - minY,
  }
}

/**
 * The direction a key means, or undefined for a key this map does not claim.
 *
 * Kept here rather than in the component so that the whole of "what the keyboard does" is one
 * testable thing, and so that a key the map ignores is visibly a decision rather than an
 * omission - PageUp and PageDown are left to the page, which is scrolling behind the map.
 */
export function directionFor(key: string): Direction | undefined {
  switch (key) {
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    case 'Home':
      return 'rowStart'
    case 'End':
      return 'rowEnd'
    default:
      return undefined
  }
}
