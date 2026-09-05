import type { SeatMapSeat } from '~/api/types'

/**
 * Nobody places five hundred seats by hand.
 *
 * This is the feature the editor is built around: everything else it does - select, move,
 * relabel, retier, delete - is editing what this produced. A map is a flat list of seats with
 * no rows and no sections (the contract has only `label`, `x`, `y`, `tierName`), so the row
 * structure a person thinks in exists here, at the moment of generation, and nowhere else.
 */

export type BlockSpec = {
  rows: number
  seatsPerRow: number
  /** Row labels count up from here: A, B, … Z, AA. */
  firstRowLabel: string
  firstSeatNumber: number
  originX: number
  originY: number
  seatGap: number
  rowGap: number
  tierName: string
  /** Rows numbered right to left, as many auditoria label them from the aisle. */
  reverseSeatNumbers?: boolean
}

/**
 * Spreadsheet-column naming: 0 is A, 25 is Z, 26 is AA.
 *
 * Bijective base 26 rather than ordinary base 26, which is why the loop subtracts one before
 * dividing - without that, 26 would come out as `BA` and every venue with more than 26 rows
 * would be labelled wrongly from row 27 onward.
 */
export function rowLabel(index: number): string {
  if (index < 0 || !Number.isInteger(index)) {
    throw new RangeError(`row index must be a non-negative integer, got ${index}`)
  }
  let label = ''
  let remaining = index
  for (;;) {
    label = String.fromCharCode(65 + (remaining % 26)) + label
    remaining = Math.floor(remaining / 26) - 1
    if (remaining < 0) {
      return label
    }
  }
}

/** The inverse of {@link rowLabel}, so a person can start a block at row `M`. */
export function rowIndex(label: string): number {
  const upper = label.trim().toUpperCase()
  if (!/^[A-Z]+$/.test(upper)) {
    throw new RangeError(`row label must be letters, got ${JSON.stringify(label)}`)
  }
  let index = 0
  for (const character of upper) {
    index = index * 26 + (character.charCodeAt(0) - 64)
  }
  return index - 1
}

export function generateBlock(spec: BlockSpec): SeatMapSeat[] {
  const seats: SeatMapSeat[] = []
  const firstRow = rowIndex(spec.firstRowLabel)

  for (let row = 0; row < spec.rows; row++) {
    for (let seat = 0; seat < spec.seatsPerRow; seat++) {
      const number = spec.reverseSeatNumbers
        ? spec.firstSeatNumber + spec.seatsPerRow - 1 - seat
        : spec.firstSeatNumber + seat
      seats.push({
        label: `${rowLabel(firstRow + row)}${number}`,
        // Rounded because these are compared for equality: two seats sharing a position is a
        // 422 from the server, and floating point drift would invent collisions that are not
        // visible on screen and cannot be found by looking.
        x: round(spec.originX + seat * spec.seatGap),
        y: round(spec.originY + row * spec.rowGap),
        tierName: spec.tierName,
      })
    }
  }
  return seats
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
