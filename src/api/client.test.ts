import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'
import { ApiError, OfflineError } from './errors'
import { session } from './session'

/**
 * The behaviour worth testing here is the refresh, and specifically that it happens
 * *once*. Four requests failing together must not spend four refresh tokens - the
 * backend would be right to reject the losers, and the user would be signed out by
 * their own application.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

/** noUncheckedIndexedAccess is on, and a missing call should fail loudly here anyway. */
function callAt(index: number): [string, RequestInit] {
  const call = fetchMock.mock.calls[index]
  if (!call) {
    throw new Error(`expected at least ${index + 1} requests, saw ${fetchMock.mock.calls.length}`)
  }
  return call as [string, RequestInit]
}

function authorizationOf(index: number): string | undefined {
  return (callAt(index)[1].headers as Record<string, string>).Authorization
}

beforeEach(() => {
  localStorage.clear()
  session.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authentication', () => {
  it('sends the access token, and omits it on anonymous calls', async () => {
    session.adopt({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 })
    // A factory, not a shared instance: a Response body can only be read once, so
    // mockResolvedValue would hand the second call an already-drained body.
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(200, { ok: true })))

    await api.get('/me')
    await api.get('/public/events', { anonymous: true })

    expect(authorizationOf(0)).toBe('Bearer access-1')
    expect(authorizationOf(1)).toBeUndefined()
  })

  it('refreshes once and retries when the access token has expired', async () => {
    session.adopt({ accessToken: 'stale', refreshToken: 'refresh-1', expiresIn: 900 })
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { code: 'NOT_AUTHENTICATED', message: 'no' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: 'fresh', refreshToken: 'refresh-2', expiresIn: 900 }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { displayName: 'Alice' }))

    await expect(api.get<{ displayName: string }>('/me')).resolves.toEqual({ displayName: 'Alice' })

    expect(callAt(1)[0]).toBe('/api/v1/auth/refresh')
    expect(session.access).toBe('fresh')
    // The retry carries the new token, not the one that just failed.
    expect(authorizationOf(2)).toBe('Bearer fresh')
  })

  it('refreshes once for many requests failing at the same time', async () => {
    session.adopt({ accessToken: 'stale', refreshToken: 'refresh-1', expiresIn: 900 })
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(
          jsonResponse(200, { accessToken: 'fresh', refreshToken: 'refresh-2', expiresIn: 900 }),
        )
      }
      return Promise.resolve(
        session.access === 'fresh'
          ? jsonResponse(200, { ok: true })
          : jsonResponse(401, { code: 'NOT_AUTHENTICATED', message: 'no' }),
      )
    })

    await Promise.all([api.get('/me'), api.get('/orders'), api.get('/venues'), api.get('/events')])

    const refreshes = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))
    expect(refreshes).toHaveLength(1)
  })

  it('signs out when the refresh token is no longer good', async () => {
    session.adopt({ accessToken: 'stale', refreshToken: 'revoked', expiresIn: 900 })
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { code: 'NOT_AUTHENTICATED', message: 'no' }))
      .mockResolvedValueOnce(jsonResponse(401, null))

    await expect(api.get('/me')).rejects.toBeInstanceOf(ApiError)
    expect(session.access).toBeNull()
    expect(session.refresh).toBeNull()
  })

  it('does not spend the session when the network is simply down', async () => {
    session.adopt({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 })
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(api.get('/me')).rejects.toBeInstanceOf(OfflineError)
    // Coming back online should not have cost a sign-in.
    expect(session.refresh).toBe('refresh-1')
  })
})

describe('failures', () => {
  it('branches on the contract code rather than the status', async () => {
    // SEATS_UNAVAILABLE and ORDER_ALREADY_PAID are both 409 and mean entirely different
    // things to a buyer, which is why the envelope carries a code at all.
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        code: 'SEATS_UNAVAILABLE',
        message: 'These seats were taken while you were choosing: A1.',
        details: { seatIds: ['seat-a1'] },
      }),
    )

    await api.post('/checkout', {}, { anonymous: true }).catch((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError)
      const failure = error as ApiError
      expect(failure.is('SEATS_UNAVAILABLE')).toBe(true)
      expect(failure.is('ORDER_ALREADY_PAID')).toBe(false)
      expect(failure.seatIds).toEqual(['seat-a1'])
      // The backend writes messages meant to be read; rewriting them here is a downgrade.
      expect(failure.message).toContain('A1')
    })
    expect.assertions(5)
  })

  it('survives a failure that is not the contract envelope at all', async () => {
    // A proxy or a gateway answers with HTML, and the error path must not itself throw.
    fetchMock.mockResolvedValue(new Response('<html>502</html>', { status: 502 }))

    await expect(api.get('/me', { anonymous: true })).rejects.toMatchObject({
      status: 502,
      code: 'UNPARSEABLE',
    })
  })
})
