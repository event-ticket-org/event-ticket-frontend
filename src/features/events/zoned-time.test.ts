import { describe, expect, it } from 'vitest'
import { instantFromZoned, isPast, zonedInputValue } from './zoned-time'

/**
 * Every one of these passes if you use the browser's zone instead of the venue's, as long as
 * the browser happens to be in Vietnam - which is the whole trap `nfr.md` warns about. The
 * daylight-saving cases are here because they cannot pass by accident.
 */

const HANOI = 'Asia/Ho_Chi_Minh'
const LONDON = 'Europe/London'
const NEW_YORK = 'America/New_York'

describe('a wall-clock time in the venue timezone becomes an instant', () => {
  it('reads 19:30 in Hanoi as 12:30 UTC', () => {
    // ICT is UTC+7 all year.
    expect(instantFromZoned('2026-06-01T19:30', HANOI)).toBe('2026-06-01T12:30:00.000Z')
  })

  it('knows London is on summer time in June and not in January', () => {
    expect(instantFromZoned('2026-06-01T19:30', LONDON)).toBe('2026-06-01T18:30:00.000Z')
    expect(instantFromZoned('2026-01-01T19:30', LONDON)).toBe('2026-01-01T19:30:00.000Z')
  })

  it('handles the evening a clock goes forward', () => {
    // 02:00 does not exist on 29 March 2026 in London; the hour is skipped. Whatever a
    // browser hands us for it must still land on a real instant rather than NaN.
    const settled = instantFromZoned('2026-03-29T02:30', LONDON)
    expect(Number.isNaN(Date.parse(settled))).toBe(false)
  })

  it('handles the evening a clock goes back', () => {
    // 01:30 happens twice on 1 November 2026 in New York. Either instant is defensible;
    // silently producing a time seven hours out is not.
    const settled = instantFromZoned('2026-11-01T01:30', NEW_YORK)
    expect(['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']).toContain(settled)
  })

  it('refuses anything that is not a local date-time', () => {
    // Date.parse accepts a surprising amount and returns a date for much of it, so the shape
    // is checked directly - otherwise a malformed value becomes a confidently wrong instant,
    // and this one ends up printed on a ticket.
    for (const bad of ['tomorrow evening', '2026-06-01', '01/06/2026 19:30', '', '2026-06-01T19:30:00Z']) {
      expect(() => instantFromZoned(bad, HANOI)).toThrow(RangeError)
    }
  })
})

describe('an instant becomes the value a datetime-local input wants', () => {
  it('renders in the venue zone, not the reader’s', () => {
    expect(zonedInputValue('2026-06-01T12:30:00Z', HANOI)).toBe('2026-06-01T19:30')
    expect(zonedInputValue('2026-06-01T12:30:00Z', LONDON)).toBe('2026-06-01T13:30')
    expect(zonedInputValue('2026-06-01T12:30:00Z', NEW_YORK)).toBe('2026-06-01T08:30')
  })

  it('crosses the date line where the zone does', () => {
    // Half past eleven at night UTC is already the next morning in Hanoi. An editor that
    // shows the UTC date here has an organizer publishing on the wrong day.
    expect(zonedInputValue('2026-06-01T23:30:00Z', HANOI)).toBe('2026-06-02T06:30')
  })

  it('renders midnight as 00:00 rather than 24:00', () => {
    // hour12: false gives 24 for midnight in some engines, and a datetime-local input
    // rejects 24:00 outright - the field simply comes up empty.
    expect(zonedInputValue('2026-06-01T17:00:00Z', HANOI)).toBe('2026-06-02T00:00')
  })

  it('is empty for an instant that is not one', () => {
    expect(zonedInputValue('not a time', HANOI)).toBe('')
  })
})

describe('the two directions agree', () => {
  it('round-trips a time in every zone tested', () => {
    for (const zone of [HANOI, LONDON, NEW_YORK]) {
      for (const local of ['2026-01-15T09:00', '2026-06-15T19:30', '2026-12-31T23:59']) {
        expect(zonedInputValue(instantFromZoned(local, zone), zone)).toBe(local)
      }
    }
  })
})

describe('scheduling backwards', () => {
  const now = Date.parse('2026-06-01T12:00:00Z')

  it('knows what has already happened', () => {
    expect(isPast('2026-05-31T23:59:00Z', now)).toBe(true)
    expect(isPast('2026-06-01T12:00:01Z', now)).toBe(false)
    expect(isPast(null, now)).toBe(false)
  })
})
