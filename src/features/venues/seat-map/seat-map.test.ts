import { describe, expect, it } from 'vitest'
import type { SeatMapSeat } from '~/api/types'
import {
  boundsOf,
  panBounds,
  rectBetween,
  FINE_SNAP,
  seatsWithin,
  snap,
  viewBoxOf,
  zoomBounds,
  zoomLimits,
} from './geometry'
import { generateBlock, rowIndex, rowLabel } from './generator'
import { tierNamesInUse, validateSeatMap } from './validation'

/**
 * The seat map's geometry is testable and its canvas is not, so this covers the arithmetic
 * and leaves the pointer handling to be judged by using it.
 */

describe('row labels', () => {
  it('counts up the alphabet', () => {
    expect(rowLabel(0)).toBe('A')
    expect(rowLabel(25)).toBe('Z')
  })

  it('carries into two letters the way a spreadsheet column does', () => {
    // Bijective base 26, not ordinary base 26. Get this wrong and row 27 is labelled BA,
    // which nobody notices until a venue is big enough to have one.
    expect(rowLabel(26)).toBe('AA')
    expect(rowLabel(27)).toBe('AB')
    expect(rowLabel(51)).toBe('AZ')
    expect(rowLabel(52)).toBe('BA')
    expect(rowLabel(701)).toBe('ZZ')
    expect(rowLabel(702)).toBe('AAA')
  })

  it('round-trips through its inverse', () => {
    for (const index of [0, 1, 25, 26, 27, 51, 52, 701, 702, 1000]) {
      expect(rowIndex(rowLabel(index))).toBe(index)
    }
  })

  it('refuses a label that is not letters', () => {
    expect(() => rowIndex('A1')).toThrow(RangeError)
    expect(() => rowLabel(-1)).toThrow(RangeError)
  })
})

describe('generating a block', () => {
  const spec = {
    rows: 3,
    seatsPerRow: 4,
    firstRowLabel: 'A',
    firstSeatNumber: 1,
    originX: 0,
    originY: 0,
    seatGap: 1,
    rowGap: 1.2,
    tierName: 'Standard',
  }

  it('produces rows by letter and seats by number', () => {
    const seats = generateBlock(spec)
    expect(seats).toHaveLength(12)
    expect(seats.map((seat) => seat.label).slice(0, 5)).toEqual(['A1', 'A2', 'A3', 'A4', 'B1'])
    expect(seats.at(-1)?.label).toBe('C4')
  })

  it('starts wherever the person asks it to', () => {
    const seats = generateBlock({ ...spec, firstRowLabel: 'M', firstSeatNumber: 10 })
    expect(seats[0]?.label).toBe('M10')
    expect(seats[4]?.label).toBe('N10')
  })

  it('numbers a row from the other end when asked', () => {
    // Many auditoria number outward from the aisle, and a generator that cannot do it makes
    // somebody relabel every seat by hand.
    const seats = generateBlock({ ...spec, reverseSeatNumbers: true })
    expect(seats.slice(0, 4).map((seat) => seat.label)).toEqual(['A4', 'A3', 'A2', 'A1'])
  })

  it('never generates two seats in the same place', () => {
    // The server refuses the whole document over one collision, and floating point drift
    // from repeated addition is the way a generator produces one nobody can see.
    const seats = generateBlock({ ...spec, rows: 40, seatsPerRow: 40, seatGap: 0.1, rowGap: 0.1 })
    const positions = new Set(seats.map((seat) => `${seat.x},${seat.y}`))
    expect(positions.size).toBe(seats.length)
  })

  it('lays rows out downward and seats rightward from the origin', () => {
    const seats = generateBlock({ ...spec, originX: 5, originY: 2 })
    expect(seats[0]).toMatchObject({ x: 5, y: 2 })
    expect(seats[1]).toMatchObject({ x: 6, y: 2 })
    expect(seats[4]).toMatchObject({ x: 5, y: 3.2 })
  })
})

describe('validation mirrors the server', () => {
  const seat = (label: string, x: number, y: number): SeatMapSeat => ({
    label,
    x,
    y,
    tierName: 'Standard',
  })

  it('accepts a map with nothing wrong with it', () => {
    expect(validateSeatMap({ seats: [seat('A1', 0, 0), seat('A2', 1, 0)] })).toEqual([])
  })

  it('finds duplicate labels', () => {
    const problems = validateSeatMap({ seats: [seat('A1', 0, 0), seat('A1', 1, 0)] })
    expect(problems).toEqual([{ kind: 'DUPLICATE_LABEL', label: 'A1', count: 2 }])
  })

  it('treats labels as exact, because the server does', () => {
    // `a1` and `A1` are two seats to Postgres and to SeatMapDocument alike. Folding case
    // here would refuse an edit the server accepts, which is its own kind of wrong.
    expect(validateSeatMap({ seats: [seat('A1', 0, 0), seat('a1', 1, 0)] })).toEqual([])
  })

  it('finds seats sharing a position', () => {
    const problems = validateSeatMap({ seats: [seat('A1', 2, 3), seat('B7', 2, 3)] })
    expect(problems).toEqual([
      { kind: 'SHARED_POSITION', labels: ['A1', 'B7'], x: 2, y: 3 },
    ])
  })

  it('finds seats with no label at all', () => {
    expect(validateSeatMap({ seats: [seat('  ', 0, 0)] })).toContainEqual({
      kind: 'BLANK_LABEL',
      count: 1,
    })
  })

  it('reports tiers in the order they first appear, as the server does', () => {
    const seats = [seat('A1', 0, 0), seat('A2', 1, 0), seat('A3', 2, 0)]
    seats[0]!.tierName = 'VIP'
    seats[2]!.tierName = 'VIP'
    expect(tierNamesInUse(seats)).toEqual(['VIP', 'Standard'])
  })
})

describe('framing the map', () => {
  const map = {
    seats: [
      { label: 'A1', x: 0, y: 0, tierName: 'Standard' },
      { label: 'A2', x: 10, y: 5, tierName: 'Standard' },
    ],
    elements: [],
  }

  it('includes a whole seat circle, not just its centre', () => {
    const bounds = boundsOf(map)
    expect(bounds?.minX).toBeLessThan(0)
    expect(bounds?.maxX).toBeGreaterThan(10)
  })

  it('is null for an empty map, so a caller has to say what to draw instead', () => {
    expect(boundsOf({ seats: [], elements: [] })).toBeNull()
  })

  it('counts a map element by its own size', () => {
    const bounds = boundsOf({
      seats: [],
      elements: [{ kind: 'STAGE', x: 0, y: 0, width: 12, height: 2 }],
    })
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 12, maxY: 2 })
  })

  it('never produces a viewBox with no extent', () => {
    // A single seat, or one row with no depth, would divide by zero inside the browser and
    // render nothing - which looks exactly like a broken component rather than a small map.
    const single = boundsOf({ seats: [{ label: 'A1', x: 3, y: 3, tierName: 'S' }], elements: [] })
    const [, , width, height] = viewBoxOf(single!).split(' ').map(Number)
    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(0)
  })

  it('keeps the point under the cursor still while zooming', () => {
    // The whole feel of a zoom is this one property: whatever you are pointing at stays
    // where it is, and everything else moves around it.
    const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    const about = { x: 2, y: 8 }
    const zoomed = zoomBounds(bounds, 0.5, about)
    // The cursor sits at the same fraction across the box before and after.
    expect((about.x - zoomed.minX) / (zoomed.maxX - zoomed.minX)).toBeCloseTo(
      (about.x - bounds.minX) / (bounds.maxX - bounds.minX),
    )
    expect((about.y - zoomed.minY) / (zoomed.maxY - zoomed.minY)).toBeCloseTo(
      (about.y - bounds.minY) / (bounds.maxY - bounds.minY),
    )
    expect(zoomed.maxX - zoomed.minX).toBe(5)
  })

  it('pans without changing the extent', () => {
    const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 4 }
    const moved = panBounds(bounds, 3, -1)
    expect(moved).toEqual({ minX: 3, minY: -1, maxX: 13, maxY: 3 })
  })
})

describe('marquee selection', () => {
  const seats: SeatMapSeat[] = [
    { label: 'A1', x: 0, y: 0, tierName: 'Standard' },
    { label: 'A2', x: 5, y: 5, tierName: 'Standard' },
    { label: 'A3', x: 20, y: 20, tierName: 'Standard' },
  ]

  it('works dragged in any direction', () => {
    // A rectangle dragged up and to the left is the same rectangle.
    const downRight = rectBetween({ x: -1, y: -1 }, { x: 10, y: 10 })
    const upLeft = rectBetween({ x: 10, y: 10 }, { x: -1, y: -1 })
    expect(downRight).toEqual(upLeft)
    expect(seatsWithin(seats, downRight).map((seat) => seat.label)).toEqual(['A1', 'A2'])
  })

  it('selects nothing for an empty drag', () => {
    expect(seatsWithin(seats, rectBetween({ x: 3, y: 3 }, { x: 3, y: 3 }))).toEqual([])
  })
})

describe('zoom is bounded, because getting lost had no escape', () => {
  const content = { minX: 0, minY: 0, maxX: 26, maxY: 16 }

  it('refuses to zoom out past a few times the content', () => {
    // Thirty notches out turned a 26-unit map into a 545-unit view of blank paper, with no
    // way back except reloading and losing the draft.
    let bounds = content
    for (let i = 0; i < 40; i++) {
      bounds = zoomBounds(bounds, 1.1, { x: 13, y: 8 }, content)
    }
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(zoomLimits(content).max)
  })

  it('refuses to zoom in past a couple of seats', () => {
    let bounds = content
    for (let i = 0; i < 60; i++) {
      bounds = zoomBounds(bounds, 0.9, { x: 13, y: 8 }, content)
    }
    expect(bounds.maxX - bounds.minX).toBeGreaterThanOrEqual(zoomLimits(content).min)
  })

  it('still keeps the point under the cursor still within the limits', () => {
    const about = { x: 4, y: 12 }
    const zoomed = zoomBounds(content, 0.5, about, content)
    expect((about.x - zoomed.minX) / (zoomed.maxX - zoomed.minX)).toBeCloseTo(
      (about.x - content.minX) / (content.maxX - content.minX),
    )
  })
})

describe('snapping', () => {
  it('puts a dragged position on a lattice so an overlap is exact', () => {
    // The shared-position rule compares x,y for equality, on both sides. A drag measured in
    // pixels produces 1.988, which equals nothing - so a seat dropped squarely on another
    // was accepted by the editor and by the server, drawn one on top of the other.
    expect(snap(1.988)).toBe(2)
    expect(snap(0.994)).toBe(1)
    expect(snap(2.13)).toBe(2.25)
    expect(snap(-0.6)).toBe(-0.5)
  })

  it('makes two seats dragged to the same place collide detectably', () => {
    const a = { label: 'A1', x: snap(1.988), y: snap(0.994), tierName: 'S' }
    const b = { label: 'B7', x: snap(2.02), y: snap(1.01), tierName: 'S' }
    expect(validateSeatMap({ seats: [a, b] })).toContainEqual({
      kind: 'SHARED_POSITION',
      labels: ['A1', 'B7'],
      x: 2,
      y: 1,
    })
  })
})

describe('the fine lattice', () => {
  it('is finer, and still a lattice', () => {
    // Escaping the grid entirely is not on offer: exact coordinates are the only reason two
    // stacked seats are detectable at all. A finer step frees the hand without giving that up.
    expect(snap(1.988, FINE_SNAP)).toBe(2)
    expect(snap(1.97, FINE_SNAP)).toBe(1.95)
    expect(snap(2.13, FINE_SNAP)).toBeCloseTo(2.15)
  })

  it('still makes an exact stack detectable', () => {
    const a = { label: 'A1', x: snap(2.01, FINE_SNAP), y: snap(0.99, FINE_SNAP), tierName: 'S' }
    const b = { label: 'B7', x: snap(1.99, FINE_SNAP), y: snap(1.01, FINE_SNAP), tierName: 'S' }
    expect(validateSeatMap({ seats: [a, b] })).toContainEqual({
      kind: 'SHARED_POSITION',
      labels: ['A1', 'B7'],
      x: 2,
      y: 1,
    })
  })
})
