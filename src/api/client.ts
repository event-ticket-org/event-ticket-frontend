import { ApiError, OfflineError } from './errors'
import { session } from './session'
import type { ApiErrorBody, TokenPair } from './types'

const BASE = '/api/v1'

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Public endpoints send no bearer, so an expired token cannot turn a 200 into a 401. */
  anonymous?: boolean
  signal?: AbortSignal
}

/**
 * The one place a request is made.
 *
 * Written by hand rather than generated, because the three things that matter here are
 * ours and specific: the bearer token, the single-flight refresh-and-retry, and the
 * contract's error envelope. A generated client hides all three behind someone else's
 * opinion, and the types are the part worth generating anyway.
 */
export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const send = () => fetch(BASE + path, buildInit(options))

  let response = await attempt(send)

  // One retry, and only for an expired access token. A 401 after a successful refresh
  // means the credential is genuinely gone - the Membership was removed, the refresh
  // token revoked - and retrying again would loop.
  if (response.status === 401 && !options.anonymous && session.refresh) {
    const refreshed = await session.refreshOnce(renewSession)
    if (refreshed) {
      response = await attempt(send)
    }
  }

  if (response.status === 204 || response.status === 202) {
    return undefined as T
  }
  if (!response.ok) {
    throw new ApiError(response.status, asErrorBody(await readBody(response)))
  }
  return (await readBody(response)) as T
}

/**
 * Exchanges the refresh token for a new pair. Called through `session.refreshOnce`, so
 * concurrent failures share one attempt.
 *
 * Failure clears the session rather than throwing: the caller is in the middle of some
 * other request, and the honest outcome is "you are signed out", not an error about
 * tokens.
 */
async function renewSession(): Promise<boolean> {
  const refreshToken = session.refresh
  if (!refreshToken) {
    return false
  }
  try {
    const response = await fetch(BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!response.ok) {
      session.clear()
      return false
    }
    session.adopt((await response.json()) as TokenPair)
    return true
  } catch {
    // Offline. Keep the tokens: the network coming back should not have cost a session.
    return false
  }
}

function buildInit(options: Options): RequestInit {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (!options.anonymous && session.access) {
    headers.Authorization = `Bearer ${session.access}`
  }
  return {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  }
}

async function attempt(send: () => Promise<Response>): Promise<Response> {
  try {
    return await send()
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause
    }
    throw new OfflineError()
  }
}

/**
 * The contract answers every failure with one envelope, but a proxy, a gateway or a
 * crash can answer with something else entirely. Anything unrecognisable becomes an
 * ApiError with no code rather than a crash inside the error path.
 */
function asErrorBody(body: unknown): Partial<ApiErrorBody> | null {
  return body !== null && typeof body === 'object' ? (body as Partial<ApiErrorBody>) : null
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<Options, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<Options, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<Options, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<Options, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: Omit<Options, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}
