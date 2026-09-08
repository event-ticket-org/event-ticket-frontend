import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ForgotPasswordPage, ResetPasswordPage } from './AuthPages'

/**
 * requirements/001 criteria 17 and 19, asserted where they can actually be broken.
 *
 * The server is written so that it cannot report whether an address has an account. That
 * guarantee is only worth as much as the screen in front of it: a success page reading "we
 * have sent you an email" would announce, in the product, exactly what the endpoint refuses to
 * say - and nothing in the backend's own tests can catch that.
 */

afterEach(cleanup)

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

// `fireEvent` rather than `user-event`: this project does not have that package, and the two
// lines it would save are not worth a dependency. Typing character by character is not what
// these tests are about - what is submitted is.
function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } })
}

function submit(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

/**
 * The request a mutation makes is not made synchronously with the click, so asserting "did not
 * call fetch" straight after one passes whatever the code does. This settles the queue first,
 * which is what makes the negative assertions mean anything - the first draft of this file had
 * one that could not fail.
 */
async function settle() {
  await waitFor(() => expect(true).toBe(true))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function accepted() {
  return new Response(null, { status: 202 })
}

function onPage(element: React.ReactNode, path = '/forgot-password') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path.split('?')[0]} element={element} />
          {/* Where a completed reset lands. Named, so the test can say so. */}
          <Route path="/" element={<p>signed in</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('asking for a reset link', () => {
  /**
   * The wording is the assertion. "If that address has an account" is conditional on purpose,
   * and a well-meaning edit to "We have sent a link to…" would undo criterion 17 without
   * touching a line of the server.
   */
  it('does not tell the visitor whether the address has an account', async () => {
    fetchMock.mockResolvedValue(accepted())
    onPage(<ForgotPasswordPage />)

    type(screen.getByLabelText(/email/i), 'someone@example.com')
    submit(/send the link/i)

    const confirmation = await screen.findByText(/has an account/i)
    expect(confirmation.textContent).toMatch(/^If /)
    // The one phrasing that would give the game away, whatever else the page says.
    expect(document.body.textContent).not.toMatch(/we (have )?sent (you )?an email/i)
  })
})

describe('setting the new password', () => {
  it('refuses a link with no token, and offers a way to get one', async () => {
    onPage(<ResetPasswordPage />, '/reset-password')

    expect(screen.getByRole('link', { name: /ask for a new link/i }).getAttribute('href'))
      .toBe('/forgot-password')
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  /**
   * A mistyped password takes effect immediately and every other session has just been
   * revoked, so the typo is a second lockout reached from inside the recovery from the first.
   * The check is worth having precisely because the server cannot make it.
   */
  it('does not submit two passwords that differ', async () => {
    onPage(<ResetPasswordPage />, '/reset-password?token=abc')

    type(screen.getByLabelText(/^new password$/i), 'a-long-enough-password')
    type(screen.getByLabelText(/again/i), 'a-long-enough-passwerd')
    submit(/set the password/i)

    expect(screen.getByRole('alert').textContent).toMatch(/do not match/i)
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the token and the password once they match', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    onPage(<ResetPasswordPage />, '/reset-password?token=abc')

    type(screen.getByLabelText(/^new password$/i), 'a-long-enough-password')
    type(screen.getByLabelText(/again/i), 'a-long-enough-password')
    submit(/set the password/i)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('/auth/reset-password')
    expect(JSON.parse(String(init.body))).toEqual({
      token: 'abc',
      password: 'a-long-enough-password',
    })
    // Criterion 19: they are signed in, so they land in the application rather than back at a
    // form asking for the password they have just chosen.
    expect(await screen.findByText('signed in')).toBeTruthy()
  })
})
