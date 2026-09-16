import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventRail } from './EventRail'

/**
 * A rail with too little in it does not appear, and does not ask for anything either.
 *
 * requirements/009 criterion 16. This is the decision the whole home page turns on: with the
 * catalogue this ships against, no category clears the threshold, so the page is a filter strip
 * and a listing. If the threshold stopped being honoured the page would fill with rows of one
 * card, which looks like a broken fetch rather than like a small catalogue.
 *
 * The second assertion is the one that would otherwise rot quietly. Returning `null` after
 * fetching would still hide the row, and would spend a request per category on every home page
 * load to decide to draw nothing - invisible, and exactly the kind of thing a mapped
 * association would have done too.
 */

afterEach(cleanup)

const fetchMock = vi.fn()

/** A real `Response`, like `client.test.ts` builds - the client reads more of one than a
    hand-rolled object tends to provide, and a shape that is merely close fails as a blank page. */
function page(items: number): Response {
  return new Response(
    JSON.stringify({
      items: Array.from({ length: items }, (_, index) => ({
        id: `event-${index}`,
        title: `Event ${index}`,
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
      })),
      nextCursor: null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => page(0))
  vi.stubGlobal('fetch', fetchMock)
})

function railWith(count: number) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EventRail categorySlug="nhac-song" title="Nhạc sống" minimum={5} count={count} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('a category rail', () => {
  it('draws nothing when the category holds fewer events than the minimum', () => {
    railWith(4)
    expect(screen.queryByText('Nhạc sống')).toBeNull()
  })

  it('does not fetch a row it has already decided not to draw', () => {
    railWith(4)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches once the count clears the minimum', () => {
    railWith(5)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('categorySlug=nhac-song')
  })

  it('draws the row once enough events come back', async () => {
    fetchMock.mockImplementation(async () => page(6))
    railWith(6)

    expect(await screen.findByRole('heading', { name: 'Nhạc sống' })).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })

  /**
   * The count and the row have to agree, and the count is a moment older than the row. An
   * event selling out or being unlisted between the two leaves a category advertising six and
   * returning four, and the row is drawn from what came back rather than from what was
   * promised.
   *
   * Asserted by waiting for the fetch and then looking, rather than by waiting for a heading
   * that never arrives - `findBy*` would spend its whole timeout proving a negative.
   */
  it('still draws nothing when the count promised more than the fetch returned', async () => {
    fetchMock.mockImplementation(async () => page(3))
    railWith(6)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Nhạc sống')).toBeNull()
  })
})
