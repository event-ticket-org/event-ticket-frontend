import { describe, expect, it } from 'vitest'
import { endOfDay, startOfDay, thisMonth, thisWeekend } from './public-hooks'

/**
 * Asserted as properties rather than as literal strings: these run in whatever zone the
 * machine is in, and a test that only passes at UTC+07 is a test that fails on somebody
 * else's laptop for a reason that has nothing to do with the code.
 */
describe('reading a typed date as an instant', () => {
  it('gives nothing back for an empty field, so the filter is simply absent', () => {
    expect(startOfDay('')).toBeUndefined()
    expect(endOfDay('')).toBeUndefined()
  })

  it('covers the whole day, in the reader’s own zone', () => {
    const from = new Date(startOfDay('2026-09-10')!)
    const to = new Date(endOfDay('2026-09-10')!)
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000 - 1)
    // Local, which is the whole point: the same calendar day comes back out.
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(8)
    expect(from.getDate()).toBe(10)
    expect(from.getHours()).toBe(0)
    expect(to.getHours()).toBe(23)
  })

  /** One day chosen at both ends is that day, not an empty range. */
  it('is inclusive at both ends', () => {
    expect(startOfDay('2026-09-10')! < endOfDay('2026-09-10')!).toBe(true)
  })

  it('sends an instant, which is what the contract asks for', () => {
    expect(startOfDay('2026-09-10')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})

/**
 * The two named ranges, which the home page's tabs send instead of typed dates.
 *
 * Both are computed in the browser's timezone, deliberately and for the same reason the typed
 * filters are: a weekend is a weekend where the reader is standing. Reading it in a venue's
 * zone would make the same tab mean different days depending on which events were in the list.
 */
describe('this weekend', () => {
  it('runs Saturday to the end of Sunday, from midweek', () => {
    // A Wednesday.
    const range = thisWeekend(new Date(2026, 8, 16, 11, 0))

    expect(new Date(range.startsAfter).getDay()).toBe(6)
    expect(new Date(range.startsBefore).getDay()).toBe(0)
    expect(new Date(range.startsBefore).getHours()).toBe(23)
  })

  it('means this weekend on a Saturday, not the next one', () => {
    const saturday = new Date(2026, 8, 19, 9, 0)
    const range = thisWeekend(saturday)

    expect(new Date(range.startsAfter).getDate()).toBe(19)
  })

  it('means this weekend on a Sunday too', () => {
    const sunday = new Date(2026, 8, 20, 9, 0)
    const range = thisWeekend(sunday)

    // Saturday has already been, so the range starts now rather than yesterday: a bound in the
    // past asks the server for events it refuses to list, and reads as a tab that does nothing.
    expect(new Date(range.startsAfter).getDate()).toBe(20)
    expect(new Date(range.startsBefore).getDate()).toBe(20)
  })

  it('never begins in the past', () => {
    const saturdayAfternoon = new Date(2026, 8, 19, 15, 0)
    const range = thisWeekend(saturdayAfternoon)

    expect(new Date(range.startsAfter).getTime()).toBeGreaterThanOrEqual(
      saturdayAfternoon.getTime(),
    )
  })
})

describe('this month', () => {
  it('runs from now to the last day of the month', () => {
    const range = thisMonth(new Date(2026, 8, 16, 11, 0))

    expect(new Date(range.startsAfter).getDate()).toBe(16)
    expect(new Date(range.startsBefore).getMonth()).toBe(8)
    expect(new Date(range.startsBefore).getDate()).toBe(30)
  })

  it('handles a month that does not have thirty days', () => {
    const range = thisMonth(new Date(2026, 1, 3, 11, 0))

    expect(new Date(range.startsBefore).getMonth()).toBe(1)
    expect(new Date(range.startsBefore).getDate()).toBe(28)
  })
})
