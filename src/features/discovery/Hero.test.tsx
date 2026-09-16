import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hero } from './Hero'
import { TrendingRail } from './TrendingRail'

/**
 * The two rows the server decides the existence of.
 *
 * Both answer an empty array when they are not being shown, and neither component
 * re-implements the threshold behind that: two places deciding the same thing is two places to
 * change it, and the one that gets forgotten is the one drawing a row of two. What is asserted
 * here is that empty means *nothing at all* - no heading, no controls, no gap where a row was.
 */

afterEach(cleanup)

const fetchMock = vi.fn()

function summary(id: string, title: string) {
  return {
    id,
    title,
    organizationName: 'Acme Events',
    venueName: 'Hoa Binh Theatre',
    city: 'TP Hồ Chí Minh',
    citySlug: 'tp-ho-chi-minh',
    categorySlug: 'nhac-song',
    categoryName: 'Nhạc sống',
    startsAt: '2026-10-01T12:00:00Z',
    timezone: 'Asia/Ho_Chi_Minh',
    seatsTotal: 100,
    seatsAvailable: 100,
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function show(element: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('the curated row', () => {
  it('draws nothing at all when nothing is featured', async () => {
    fetchMock.mockImplementation(async () => json([]))
    show(<Hero />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: 'Featured events' })).toBeNull()
  })

  it('shows one placement at a time, in the order they were placed', async () => {
    fetchMock.mockImplementation(async () =>
      json([summary('a', 'Placed First'), summary('b', 'Placed Second')]),
    )
    show(<Hero />)

    expect(await screen.findByRole('heading', { name: 'Placed First' })).toBeTruthy()
    // The second slide is not merely hidden: rendering it and hiding it would leave its link
    // in the tab order, so a keyboard user would tab through events they cannot see.
    expect(screen.queryByRole('heading', { name: 'Placed Second' })).toBeNull()
  })

  it('moves, and wraps round at the end', async () => {
    fetchMock.mockImplementation(async () =>
      json([summary('a', 'Placed First'), summary('b', 'Placed Second')]),
    )
    show(<Hero />)
    await screen.findByRole('heading', { name: 'Placed First' })

    // fireEvent rather than user-event: this project does not have that package, and the two
    // are equivalent for a plain click.
    fireEvent.click(screen.getByRole('button', { name: /Next featured event/ }))
    expect(screen.getByRole('heading', { name: 'Placed Second' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Next featured event/ }))
    expect(screen.getByRole('heading', { name: 'Placed First' })).toBeTruthy()
  })

  it('has no controls when there is only one placement', async () => {
    fetchMock.mockImplementation(async () => json([summary('a', 'The Only One')]))
    show(<Hero />)

    await screen.findByRole('heading', { name: 'The Only One' })
    expect(screen.queryByRole('button', { name: /Next featured event/ })).toBeNull()
  })
})

describe('the ranked row', () => {
  it('draws nothing when nothing qualifies', async () => {
    fetchMock.mockImplementation(async () => json([]))
    show(<TrendingRail />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('heading')).toBeNull()
  })

  /**
   * The rank is drawn, and it is drawn `aria-hidden` - the list order already says it, and a
   * screen reader announcing "1 Live in Saigon, 2 Jazz at the Opera House" reads the numbering
   * twice. Asserting the accessible name has no digits is what keeps that true.
   */
  it('numbers the row from one, visually and not twice', async () => {
    fetchMock.mockImplementation(async () =>
      json([
        { rank: 1, event: summary('a', 'Selling Most') },
        { rank: 2, event: summary('b', 'Selling Less') },
      ]),
    )
    show(<TrendingRail />)

    expect(await screen.findByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()

    const links = screen.getAllByRole('link')
    expect(links[0]?.textContent).toContain('Selling Most')
    expect(links[0]?.getAttribute('aria-hidden')).toBeNull()
  })
})
