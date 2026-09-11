import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VerifyEmailPage } from './AuthPages'

/**
 * requirements/001 criterion 8, and a bug found by running the product rather than by reading it.
 *
 * This page acts on arrival: the effect sends the token the moment it renders. React invokes an
 * effect twice in development, so it sent the same token twice, about five milliseconds apart -
 * and a verification token may only be spent once. The second request is therefore always
 * refused, and the refusal is what the page rendered, because both requests share one mutation's
 * state and the loser settles last.
 *
 * What a person saw, having just clicked a link that worked perfectly: **"That verification link
 * has expired or has already been used"** - on a page where the header had already switched to
 * the signed-in navigation. The account was fine. The screen said it was not.
 *
 * The server is not the place to fix this. It answered both requests correctly: one 200, one
 * 410, because the second really was a spent token. A double submit is also not exotic enough to
 * dismiss as a development-mode artefact - a double click, a mail client prefetching the link,
 * and a browser retrying all produce it in a production build. The page has to send one request
 * per token.
 */

afterEach(cleanup)

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

/**
 * The second request would be refused by the server, so the mock refuses it too - otherwise the
 * test would pass against a page that sends two and happens to get two successes, which is not
 * the situation being guarded against.
 */
function oneUseToken() {
  let spent = false
  return fetchMock.mockImplementation(() => {
    if (spent) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'VERIFICATION_TOKEN_INVALID',
            message: 'That verification link has expired or has already been used.',
          }),
          { status: 410, headers: { 'content-type': 'application/json' } },
        ),
      )
    }
    spent = true
    return Promise.resolve(
      new Response(JSON.stringify({ accessToken: 'a', refreshToken: 'b' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
}

async function settle() {
  await waitFor(() => expect(true).toBe(true))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Rendered inside StrictMode on purpose. That is what the application does - see main.tsx - and
 * it is the thing that made the effect run twice. A test that renders the page bare cannot fail
 * for this bug.
 */
function onVerifyPage(token = 'a-real-token') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/verify-email?token=${token}`]}>
          <Routes>
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/" element={<p>signed in</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
}

describe('following a verification link', () => {
  it('sends the token exactly once, however many times the effect runs', async () => {
    oneUseToken()
    onVerifyPage()

    await settle()

    const verifyCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('verify-email'))
    expect(verifyCalls).toHaveLength(1)
  })

  it('does not tell someone their link was already used when it has just worked', async () => {
    oneUseToken()
    onVerifyPage()

    // The success path leaves this page, so arriving is the proof the first request won.
    expect(await screen.findByText('signed in')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/already been used|expired/i)
  })
})
