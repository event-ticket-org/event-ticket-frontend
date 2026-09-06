import { describe, expect, it } from 'vitest'
import { ApiError, OfflineError } from '~/api/errors'
import { createQueryClient } from './query-client'

/**
 * Two defaults, pinned.
 *
 * Neither is visible at a call site, and both were arrived at by watching something go wrong -
 * which makes them exactly the kind of setting that gets quietly changed back.
 */
describe('the query client', () => {
  const defaults = createQueryClient().getDefaultOptions()

  /**
   * The one that matters most and shows least. `online` does not fail a mutation with no
   * connection, it pauses it: the request is never sent and runs when the signal returns. At a
   * door that admitted somebody minutes late, to a phone nobody was looking at.
   */
  it('sends a mutation whatever the browser thinks of the network', () => {
    expect(defaults.mutations?.networkMode).toBe('always')
  })

  it('leaves queries to pause, because a paused read is a spinner and not an action', () => {
    expect(defaults.queries?.networkMode).toBeUndefined()
  })

  describe('retrying a query', () => {
    const retry = defaults.queries?.retry
    const shouldRetry = (count: number, error: Error) =>
      typeof retry === 'function' ? retry(count, error) : retry

    /** A refusal the contract has a code for is an answer. Asking again gets the same no. */
    it('does not ask again after a coded refusal', () => {
      const forbidden = new ApiError(403, { code: 'NOT_PERMITTED', message: 'No.' })
      expect(shouldRetry(0, forbidden)).toBe(false)
    })

    it('asks again twice when the failure was the network', () => {
      expect(shouldRetry(0, new OfflineError())).toBe(true)
      expect(shouldRetry(1, new OfflineError())).toBe(true)
      expect(shouldRetry(2, new OfflineError())).toBe(false)
    })
  })
})
