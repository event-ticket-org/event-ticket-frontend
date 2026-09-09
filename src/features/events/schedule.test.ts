import { describe, expect, it } from 'vitest'
import { hasProblem, scheduleProblems } from './schedule'

/**
 * These assert that the client says the same thing the server says.
 *
 * The failure worth guarding against is not a missing check - the server has every one of
 * these and a request that gets past here is refused there. It is a client that refuses
 * something the API would have accepted: there is no error to read, no round trip to inspect,
 * and no way for the person to proceed. So the accepted cases below matter at least as much as
 * the refused ones.
 */

const ZONE = 'Asia/Ho_Chi_Minh'
const NOW = new Date('2026-09-09T00:00:00Z')

// Local wall-clock in Ho Chi Minh City (UTC+7), which is what the inputs hold.
const window = {
  doorsOpenAt: '2026-10-01T18:00',
  startsAt: '2026-10-01T19:00',
  endsAt: '2026-10-01T22:00',
}

function problems(overrides: Partial<typeof window>, published = false) {
  return scheduleProblems({ ...window, ...overrides }, { timeZone: ZONE, published, now: NOW })
}

describe('the admission window', () => {
  it('accepts a window in the right order', () => {
    expect(hasProblem(problems({}))).toBe(false)
  })

  it('refuses doors that open after the start', () => {
    expect(problems({ doorsOpenAt: '2026-10-01T20:00' }).doorsOpenAt).toMatch(/after the event/i)
  })

  it('accepts doors that open exactly at the start', () => {
    // The server's bound is "no later than", not "before".
    expect(problems({ doorsOpenAt: '2026-10-01T19:00' }).doorsOpenAt).toBeUndefined()
  })

  it('refuses an end before the start', () => {
    expect(problems({ endsAt: '2026-10-01T18:30' }).endsAt).toMatch(/end after it starts/i)
  })

  it('refuses an end exactly at the start, which admits nobody', () => {
    expect(problems({ endsAt: '2026-10-01T19:00' }).endsAt).toMatch(/end after it starts/i)
  })

  /**
   * The bug this whole branch came from. The server checked the two bounds together and so
   * enforced neither when either was absent; a client that copied that shape would repeat it.
   */
  it('judges each bound on its own when the other is absent', () => {
    expect(problems({ doorsOpenAt: '2026-10-01T20:00', endsAt: '' }).doorsOpenAt).toBeDefined()
    expect(problems({ endsAt: '2026-10-01T18:00', doorsOpenAt: '' }).endsAt).toBeDefined()
  })

  it('accepts an event with no window at all, which is a legal draft', () => {
    expect(hasProblem(problems({ doorsOpenAt: '', endsAt: '' }))).toBe(false)
  })
})

describe('moving the start time', () => {
  it('lets a draft sit in the past, which is how a past event gets recorded', () => {
    expect(hasProblem(problems({
      doorsOpenAt: '2025-01-01T18:00',
      startsAt: '2025-01-01T19:00',
      endsAt: '2025-01-01T22:00',
    }))).toBe(false)
  })

  it('refuses to move a published event into the past', () => {
    const refused = problems({
      doorsOpenAt: '2025-01-01T18:00',
      startsAt: '2025-01-01T19:00',
      endsAt: '2025-01-01T22:00',
    }, true)
    expect(refused.startsAt).toMatch(/cannot be moved into the past/i)
  })

  it('leaves a published event alone when it is still ahead', () => {
    expect(hasProblem(problems({}, true))).toBe(false)
  })
})

describe('half-typed input', () => {
  /**
   * A `datetime-local` reports a partial value while somebody is still typing the year. That
   * is not a mistake to shout about, and shouting would put an error under a field the moment
   * it is touched.
   */
  it('says nothing about a value that is not a date yet', () => {
    expect(hasProblem(problems({ startsAt: '2026-1' }))).toBe(false)
    expect(hasProblem(problems({ endsAt: '20' }))).toBe(false)
  })
})
