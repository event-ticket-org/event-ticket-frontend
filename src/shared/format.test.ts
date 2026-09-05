import { describe, expect, it } from 'vitest'
import { formatInZone, formatMoney, remainingUntil } from './format'

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
