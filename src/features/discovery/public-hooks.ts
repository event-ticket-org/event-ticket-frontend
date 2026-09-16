import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '~/api/client'
import { nextPageParam, pageQuery } from '~/api/paging'
import type { EventSeatMap, PublicEvent, PublicEventPage } from '~/api/types'

/**
 * Everything here is anonymous. `anonymous: true` sends no bearer, so an expired token in
 * some other tab cannot turn a public page into a 401 - somebody browsing events has no
 * account yet, and the ones who do should not see a different site.
 */
export type PublicEventFilters = {
  q?: string
  citySlug?: string
  categorySlug?: string
  startsAfter?: string
  startsBefore?: string
}

/**
 * A typed date, as the instant the filter means.
 *
 * The one place in this application where the browser's timezone is the right one. Every time
 * *shown* to a person is the Venue's (nfr.md), but a date somebody types into a filter is a day
 * in the life they are living: "from the 10th" means the 10th where they are standing, and
 * reading it in Hanoi's zone because the event happens to be in Hanoi would make the filter
 * behave differently depending on what it found.
 *
 * The range is inclusive at both ends, because a person who types the same date twice means
 * that day and not an empty set.
 */
export function startOfDay(date: string): string | undefined {
  // `T00:00` rather than the bare date: `new Date('2026-09-10')` is parsed as UTC midnight and
  // `new Date('2026-09-10T00:00')` as local, which is a difference of up to a day at the edges.
  return date ? new Date(`${date}T00:00:00.000`).toISOString() : undefined
}

export function endOfDay(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined
}

/**
 * Paged rather than a single fetch (criterion 6). A listing that quietly showed the first
 * twenty and stopped would look identical to one with twenty events in it, and would get worse
 * at exactly the moment the product got better.
 */
export function usePublicEvents(filters: PublicEventFilters) {
  const query = filterQuery(filters)

  return useInfiniteQuery({
    // Every filter is in the key, so a changed one is a different list rather than the old
    // list with new pages appended to it.
    queryKey: ['public', 'events', filterQuery(filters)],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<PublicEventPage>(`/public/events?${pageQuery(pageParam)}${query}`, {
        anonymous: true,
      }),
    getNextPageParam: nextPageParam,
  })
}

/**
 * One category's events, for a rail.
 *
 * Not an infinite query: a rail is a fixed number of cards with no "load more" in it, and the
 * whole listing is below it for anybody who wants the rest.
 *
 * `enabled` is what keeps this from costing anything on a small catalogue. The home page only
 * mounts a rail whose facet count clears the threshold, so with ten events in the database
 * this hook is never called at all - see `RAIL_MINIMUM` in PublicEventsPage.
 */
export function useCategoryRail(categorySlug: string, limit: number, enabled: boolean) {
  return useQuery({
    queryKey: ['public', 'events', 'rail', categorySlug, limit],
    queryFn: () =>
      api.get<PublicEventPage>(
        `/public/events?limit=${limit}&categorySlug=${encodeURIComponent(categorySlug)}`,
        { anonymous: true },
      ),
    enabled,
  })
}

/**
 * The filters as a query string, and the identity of the list they produce.
 *
 * One function for both, so a filter that narrows the request can never fail to change the
 * cache key - which would serve one filter's results under another's name until something
 * refetched.
 */
function filterQuery(filters: PublicEventFilters): string {
  return (
    (filters.q ? `&q=${encodeURIComponent(filters.q)}` : '') +
    (filters.citySlug ? `&citySlug=${encodeURIComponent(filters.citySlug)}` : '') +
    (filters.categorySlug ? `&categorySlug=${encodeURIComponent(filters.categorySlug)}` : '') +
    (filters.startsAfter ? `&startsAfter=${encodeURIComponent(filters.startsAfter)}` : '') +
    (filters.startsBefore ? `&startsBefore=${encodeURIComponent(filters.startsBefore)}` : '')
  )
}

/**
 * "This weekend" and "This month", as the instants they name.
 *
 * The browser's timezone, for the same reason the typed date filters use it: a weekend is a
 * weekend where the reader is standing. Reading it in a venue's zone would make the same tab
 * mean different days depending on which events happened to be in the list.
 *
 * The weekend runs Saturday to Sunday, and on a Saturday or Sunday it means *this* one rather
 * than the next - somebody tapping it on a Saturday morning is asking about today.
 */
export function thisWeekend(now = new Date()): { startsAfter: string; startsBefore: string } {
  const day = now.getDay() // 0 Sunday … 6 Saturday
  const toSaturday = day === 0 ? -1 : 6 - day
  const saturday = new Date(now)
  saturday.setDate(now.getDate() + toSaturday)
  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + 1)

  return {
    // Never earlier than now: a weekend that started yesterday would ask the server for events
    // in the past, which it refuses to list anyway, and would read as a tab that does nothing.
    startsAfter: maxInstant(now, atStartOfDay(saturday)),
    startsBefore: atEndOfDay(sunday),
  }
}

export function thisMonth(now = new Date()): { startsAfter: string; startsBefore: string } {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { startsAfter: now.toISOString(), startsBefore: atEndOfDay(last) }
}

function atStartOfDay(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString()
}

function atEndOfDay(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).toISOString()
}

function maxInstant(a: Date, b: string): string {
  return a.toISOString() > b ? a.toISOString() : b
}

export function usePublicEvent(eventId: string) {
  return useQuery({
    queryKey: ['public', 'events', 'detail', eventId],
    queryFn: () => api.get<PublicEvent>(`/public/events/${eventId}`, { anonymous: true }),
    enabled: eventId !== '',
  })
}

/**
 * The seat map, refetched while the page is open.
 *
 * requirements/004 criterion 3: availability updates while the page is open, so a buyer is
 * not choosing from a stale map. There is no push channel in the contract, so this polls -
 * five seconds is frequent enough that a seat taken by somebody else is noticed before it is
 * clicked, and slow enough to be unremarkable on a page somebody sits on while deciding.
 *
 * The map itself is frozen at publish; only availability moves.
 */
export function useEventSeatMap(eventId: string) {
  return useQuery({
    queryKey: ['public', 'events', eventId, 'seat-map'],
    queryFn: () => api.get<EventSeatMap>(`/public/events/${eventId}/seat-map`, { anonymous: true }),
    enabled: eventId !== '',
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  })
}
