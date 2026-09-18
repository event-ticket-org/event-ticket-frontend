import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicEventsPage } from './PublicEventsPage'

/**
 * The filter strip, and the one decision in it that is easy to get backwards.
 *
 * requirements/009 criterion 17 sends a count for every Category, zeroes included, and the
 * strip has to show them. The reflex is to render what matched and drop the rest, which reads
 * to a visitor as a category that does not exist rather than as one their other filters
 * emptied - and it is exactly what a `filter()` produces without anyone deciding to.
 */

afterEach(cleanup)

const fetchMock = vi.fn()

const CATEGORIES = [
  { slug: 'nhac-song', name: 'Nhạc sống' },
  { slug: 'the-thao', name: 'Thể thao' },
]
const CITIES = [{ slug: 'ha-noi', name: 'Hà Nội' }]

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/public/categories')) {
      return json(CATEGORIES)
    }
    if (url.includes('/public/cities')) {
      return json(CITIES)
    }
    // The curated and ranked rows, empty: the server decides whether either is shown, and on
    // this catalogue neither is. Without these the page would get the listing's object back
    // for both and fail on the first `.map`.
    if (url.includes('/public/featured-events') || url.includes('/public/trending-events')) {
      return json([])
    }
    return json({
      items: [],
      nextCursor: null,
      categoryFacets: [
        { slug: 'nhac-song', name: 'Nhạc sống', count: 3 },
        { slug: 'the-thao', name: 'Thể thao', count: 0 },
      ],
    })
  })
  vi.stubGlobal('fetch', fetchMock)
})

function page() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PublicEventsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('the filter strip', () => {
  it('shows every category, with what each would return', async () => {
    page()

    expect(await screen.findByRole('button', { name: /Nhạc sống/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Nhạc sống/ }).textContent).toContain('3')
  })

  it('keeps a category that matches nothing, and makes it unusable', async () => {
    page()

    const empty = await screen.findByRole('button', { name: /Thể thao/ })
    expect(empty.textContent).toContain('0')
    // Visible so a visitor can see their other filters emptied it; disabled so tapping it
    // cannot produce a listing nobody asked for.
    expect(empty.hasAttribute('disabled')).toBe(true)
  })

  it('offers the cities the platform defines, and Everywhere', async () => {
    page()

    expect(await screen.findByRole('button', { name: 'Hà Nội' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Everywhere' })).toBeTruthy()
  })

  /**
   * With no category clearing the rail minimum, nothing above the listing is fetched. The
   * requests on a first load are the three the page genuinely needs: the two vocabularies and
   * the listing itself.
   */
  it('asks for nothing it is not going to draw', async () => {
    page()
    await screen.findByRole('button', { name: /Nhạc sống/ })

    const rails = fetchMock.mock.calls.filter((call) => String(call[0]).includes('rail'))
    expect(rails).toHaveLength(0)
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes('categorySlug=')))
      .toHaveLength(0)
  })

  /**
   * A named range is pinned to the moment it was chosen. "This month" starts at *now*, and a
   * `now` read on every render is a new query key on every render - each answer re-renders the
   * page, which asks again, forever.
   */
  it('asks once for a named range, not once per render', async () => {
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'Hà Nội' }))
    fireEvent.click(screen.getByRole('button', { name: 'This month' }))

    const ranged = () =>
      fetchMock.mock.calls.filter((call) => String(call[0]).includes('startsAfter='))
    await waitFor(() => expect(ranged().length).toBeGreaterThan(0))
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(ranged()).toHaveLength(1)
  })
})
