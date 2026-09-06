import { describe, expect, it } from 'vitest'
import type { SeatMapSeat } from '~/api/types'
import { directionFor, rowNameOf, rowsOf, step } from './seat-navigation'

const seat = (label: string, x: number, y: number): SeatMapSeat => ({
  label,
  x,
  y,
  tierName: 'Standard',
})

/**
 * Three rows, deliberately ragged: the balcony is short and offset, which is the case that
 * catches navigation written as "the same position in the next row".
 *
 *   A1  A2  A3  A4      y = 0
 *   B1  B2  B3  B4      y = 1
 *       C1  C2          y = 2, offset right
 */
const seats: SeatMapSeat[] = [
  seat('A1', 0, 0), seat('A2', 1, 0), seat('A3', 2, 0), seat('A4', 3, 0),
  seat('B1', 0, 1), seat('B2', 1, 1), seat('B3', 2, 1), seat('B4', 3, 1),
  seat('C1', 1, 2), seat('C2', 2, 2),
]
const rows = rowsOf(seats)
const at = (label: string) => seats.findIndex((s) => s.label === label)
const labelAfter = (from: string, direction: Parameters<typeof step>[3]) =>
  seats[step(seats, rows, at(from), direction)]!.label

describe('finding the rows', () => {
  it('groups by position and orders each row left to right', () => {
    expect(rows.map((row) => row.map((index) => seats[index]!.label))).toEqual([
      ['A1', 'A2', 'A3', 'A4'],
      ['B1', 'B2', 'B3', 'B4'],
      ['C1', 'C2'],
    ])
  })

  /**
   * Seats are generated with an exact `y` and then dragged, which lands them on a quarter
   * pitch. A row is still a row after somebody nudges one seat in it.
   */
  it('keeps a nudged seat in its row', () => {
    const nudged = [seat('A1', 0, 0), seat('A2', 1, 0.25), seat('A3', 2, -0.25)]
    expect(rowsOf(nudged)).toHaveLength(1)
  })

  /** Array order is the order seats were generated in, and means nothing in a room. */
  it('does not depend on the order the seats arrive in', () => {
    const shuffled = [seats[7]!, seats[0]!, seats[9]!, seats[4]!]
    expect(rowsOf(shuffled).map((row) => row.map((i) => shuffled[i]!.label))).toEqual([
      ['A1'],
      ['B1', 'B4'],
      ['C2'],
    ])
  })
})

describe('moving', () => {
  it('walks along a row', () => {
    expect(labelAfter('A2', 'right')).toBe('A3')
    expect(labelAfter('A2', 'left')).toBe('A1')
  })

  /** Never off the edge: focus that leaves the map is focus somebody has to find again. */
  it('stays put at the ends of a row', () => {
    expect(labelAfter('A1', 'left')).toBe('A1')
    expect(labelAfter('A4', 'right')).toBe('A4')
  })

  it('moves between rows', () => {
    expect(labelAfter('A3', 'down')).toBe('B3')
    expect(labelAfter('B3', 'up')).toBe('A3')
  })

  /**
   * The one that matters. Rows are not the same length - a balcony is narrower than the
   * stalls - so counting along would send somebody sideways across the room. Down from B1
   * is the nearest seat in C, which is C1 above it and to the right, not "the first seat".
   */
  it('lands on the nearest seat across, not the same position along', () => {
    expect(labelAfter('B1', 'down')).toBe('C1')
    expect(labelAfter('B4', 'down')).toBe('C2')
    expect(labelAfter('C2', 'up')).toBe('B3')
  })

  it('stays put at the top and the bottom', () => {
    expect(labelAfter('A1', 'up')).toBe('A1')
    expect(labelAfter('C1', 'down')).toBe('C1')
  })

  it('jumps to the ends of a row and of the map', () => {
    expect(labelAfter('A3', 'rowStart')).toBe('A1')
    expect(labelAfter('A3', 'rowEnd')).toBe('A4')
    expect(labelAfter('B2', 'first')).toBe('A1')
    expect(labelAfter('B2', 'last')).toBe('C2')
  })

  it('survives being asked about a seat that is not in the map', () => {
    expect(step(seats, rows, 99, 'right')).toBe(99)
  })
})

describe('the keys it claims', () => {
  it('takes the arrows, Home and End', () => {
    expect(directionFor('ArrowLeft')).toBe('left')
    expect(directionFor('ArrowRight')).toBe('right')
    expect(directionFor('ArrowUp')).toBe('up')
    expect(directionFor('ArrowDown')).toBe('down')
    expect(directionFor('Home')).toBe('rowStart')
    expect(directionFor('End')).toBe('rowEnd')
  })

  /**
   * Deliberately not claimed. The page scrolls behind the map, and a component that swallows
   * PageDown takes the page's own navigation away from the person using the keyboard for
   * everything - which is the same mistake the wheel handler avoids by requiring a modifier.
   */
  it('leaves the page keys to the page', () => {
    expect(directionFor('PageDown')).toBeUndefined()
    expect(directionFor('PageUp')).toBeUndefined()
    expect(directionFor('Tab')).toBeUndefined()
  })
})

describe('naming a row', () => {
  it("uses the venue's own naming, which is what gets called out in the building", () => {
    expect(rowNameOf(['A1', 'A2', 'A3'], 1)).toBe('Row A')
    expect(rowNameOf(['AA1', 'AA2'], 1)).toBe('Row AA')
    expect(rowNameOf(['Balcony 1', 'Balcony 2'], 3)).toBe('Row Balcony')
  })

  /** Inventing a letter for a row the venue numbers differently is inventing a name. */
  it('falls back to the position when the labels share nothing', () => {
    expect(rowNameOf(['1', '2', '3'], 4)).toBe('Row 4')
    expect(rowNameOf(['Left 1', 'Right 1'], 2)).toBe('Row 2')
  })

  it('survives a row of one and a row of none', () => {
    expect(rowNameOf(['A1'], 1)).toBe('Row A1')
    expect(rowNameOf([], 7)).toBe('Row 7')
  })
})
