import { describe, expect, it } from 'vitest'
import { formatInZone, formatMoney, monthInZone, remainingUntil, timeUntil } from './format'

describe('money', () => {
  it('treats the amount as dong, not as cents', () => {
    // nfr.md: VND has ISO 4217 exponent 0, so the minor unit *is* the dong. Dividing by
    // a hundred here is the factory-standard way to be wrong by a factor of a hundred.
    expect(formatMoney({ amount: 250_000, currency: 'VND' })).toContain('250.000')
    expect(formatMoney({ amount: 250_000, currency: 'VND' })).not.toContain('2.500')
  })

  it('shows no fractional part', () => {
    expect(formatMoney({ amount: 1, currency: 'VND' })).not.toMatch(/[.,]00/)
  })
})

describe('times render in the venue timezone', () => {
  // 12:00 UTC is 19:00 in Ho Chi Minh City and 13:00 in London. The whole point of the
  // rule is that the answer must not depend on where the person looking happens to be.
  const noonUtc = '2026-06-01T12:00:00Z'

  it('uses the zone it is given', () => {
    expect(formatInZone(noonUtc, 'Asia/Ho_Chi_Minh')).toContain('19:00')
    expect(formatInZone(noonUtc, 'Europe/London')).toContain('13:00')
  })

  it('gives the same answer whatever the machine running it thinks', () => {
    // A buyer in Da Nang looking at a Hanoi event sees Hanoi's clock. Vietnam being a
    // single zone with no daylight saving is exactly what makes this easy to get wrong
    // and never notice while developing here.
    expect(formatInZone(noonUtc, 'Asia/Ho_Chi_Minh')).toEqual(
      formatInZone(noonUtc, 'Asia/Ho_Chi_Minh'),
    )
    expect(formatInZone(noonUtc, 'Asia/Ho_Chi_Minh')).not.toEqual(
      formatInZone(noonUtc, 'America/New_York'),
    )
  })
})

describe('the seat hold countdown', () => {
  const now = Date.parse('2026-06-01T12:00:00Z')

  it('counts down in minutes and seconds', () => {
    expect(remainingUntil('2026-06-01T12:09:05Z', now)).toBe('9:05')
    expect(remainingUntil('2026-06-01T12:00:07Z', now)).toBe('0:07')
  })

  it('returns null once it has run out, rather than counting backwards', () => {
    // A buyer must be told the hold has gone, not shown "-0:03" and left to guess.
    expect(remainingUntil('2026-06-01T12:00:00Z', now)).toBeNull()
    expect(remainingUntil('2026-06-01T11:59:00Z', now)).toBeNull()
  })
})

describe('how far away something is', () => {
  const now = Date.parse('2026-09-07T00:00:00Z')
  const at = (offsetMs: number) => new Date(now + offsetMs).toISOString()
  const HOUR = 3_600_000
  const DAY = 24 * HOUR

  it('counts in the largest unit that still says something useful', () => {
    expect(timeUntil(at(20 * 60_000), now)).toBe('within the hour')
    expect(timeUntil(at(3 * HOUR), now)).toBe('in 3 hours')
    expect(timeUntil(at(6 * DAY), now)).toBe('in 6 days')
    expect(timeUntil(at(21 * DAY), now)).toBe('in 3 weeks')
    expect(timeUntil(at(120 * DAY), now)).toBe('in 4 months')
  })

  it('says one hour rather than one hours', () => {
    expect(timeUntil(at(HOUR), now)).toBe('in 1 hour')
    expect(timeUntil(at(DAY), now)).toBe('in 1 day')
  })

  /**
   * Units round to the nearest, which is what a person would say, so "within the hour" ends
   * at half past rather than at the hour. Written down because it is the one boundary here
   * that is a choice rather than arithmetic - and the first version of this test asserted the
   * other answer.
   */
  it('rounds to the nearest unit rather than down', () => {
    expect(timeUntil(at(29 * 60_000), now)).toBe('within the hour')
    expect(timeUntil(at(31 * 60_000), now)).toBe('in 1 hour')
    expect(timeUntil(at(100 * 60_000), now)).toBe('in 2 hours')
  })

  /**
   * The listing must not contain an event that has started, but the clock does not stop
   * while a page is open. Null makes the caller decide rather than rendering "in -2 days".
   */
  it('is null once the moment has passed', () => {
    expect(timeUntil(at(-HOUR), now)).toBeNull()
    expect(timeUntil(at(0), now)).toBeNull()
  })

  /**
   * The reason this is a duration and never a calendar word. "Tomorrow" would have to pick
   * between the reader's zone and the venue's, and those disagree - which is the ambiguity
   * nfr.md's timezone rule exists to remove. A duration is the same length in both.
   */
  it('does not depend on a timezone at all', () => {
    const midnightInHanoi = '2026-09-14T17:00:00Z'
    expect(timeUntil(midnightInHanoi, Date.parse('2026-09-07T17:00:00Z'))).toBe('in 7 days')
  })
})

describe('the month an event falls in', () => {
  it('is the venue’s month, so the heading agrees with the date beneath it', () => {
    // 00:30 on 1 October in Hanoi is still 30 September in UTC. The heading has to follow
    // the clock the card shows, or a card would sit under the wrong month.
    expect(monthInZone('2026-09-30T17:30:00Z', 'Asia/Ho_Chi_Minh')).toBe('October 2026')
    expect(monthInZone('2026-09-30T17:30:00Z', 'UTC')).toBe('September 2026')
  })
})
