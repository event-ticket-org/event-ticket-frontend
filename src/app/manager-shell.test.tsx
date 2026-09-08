import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { AdminLayout, ManagerLayout } from './layouts'

/**
 * Every screen in the manager shell has a way out of it.
 *
 * This is the bug this file exists for, and it was reported twice. The exits used to be passed
 * in by each screen that rendered the shell, so the branch that forgot had none - and the
 * branch that forgot was the one a person meets first: registered, no Organization yet, clicked
 * Manage, and the header contained the word MANAGE and nothing else. It was fixed once by
 * filling in that branch, which left the next branch just as free to forget.
 *
 * So the assertion is made against every screen rather than against the frame, and it is made
 * by rendering rather than by reading the source: what matters is what a person can click.
 */

// Not automatic here: auto-cleanup comes with vitest's `globals`, which this project does not
// turn on. Without it the second test sees the first one's header as well as its own, and
// "found multiple elements" reads like a duplicate-rendering bug in the shell.
afterEach(cleanup)

function inShell(element: React.ReactNode, path = '/manage') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function exits() {
  return {
    back: await screen.findByRole('link', { name: /back to the app/i }),
    signOut: await screen.findByRole('button', { name: /sign out/i }),
  }
}

describe('the manager shell', () => {
  /**
   * `/me` is never answered here, so `ManagerLayout` sits in its loading branch - which is the
   * point. Even the state that renders nothing but the word "Loading" is inside a shell
   * somebody has to be able to leave.
   */
  it('lets an organizer out, whatever the screen inside is doing', async () => {
    inShell(<ManagerLayout />)

    const { back, signOut } = await exits()
    // Plain DOM assertions: jest-dom's matchers are not installed here, and `getAttribute`
    // says the same thing without adding a dependency for two lines.
    expect(back.getAttribute('href')).toBe('/')
    expect(signOut).toBeTruthy()
  })

  it('lets a platform administrator out', async () => {
    inShell(<AdminLayout />, '/admin')

    const { back, signOut } = await exits()
    expect(back.getAttribute('href')).toBe('/')
    expect(signOut).toBeTruthy()
  })
})
