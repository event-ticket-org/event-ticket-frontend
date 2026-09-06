import { describe, expect, it } from 'vitest'
import { endOfDay, startOfDay } from './public-hooks'

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
