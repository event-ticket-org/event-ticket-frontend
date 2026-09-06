import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '~/api/client'
import { nextPageParam, pageQuery } from '~/api/paging'
import type { EventSeatMap, PublicEvent, PublicEventPage } from '~/api/types'

/**
 * Everything here is anonymous. `anonymous: true` sends no bearer, so an expired token in
 * some other tab cannot turn a public page into a 401 - somebody browsing events has no
 * account yet, and the ones who do should not see a different site.
 */
export type PublicEventFilters = { city?: string; startsAfter?: string; startsBefore?: string }

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
  const query =
    (filters.city ? `&city=${encodeURIComponent(filters.city)}` : '') +
    (filters.startsAfter ? `&startsAfter=${encodeURIComponent(filters.startsAfter)}` : '') +
    (filters.startsBefore ? `&startsBefore=${encodeURIComponent(filters.startsBefore)}` : '')

  return useInfiniteQuery({
    queryKey: [
      'public',
      'events',
      filters.city ?? '',
      filters.startsAfter ?? '',
      filters.startsBefore ?? '',
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<PublicEventPage>(`/public/events?${pageQuery(pageParam)}${query}`, {
        anonymous: true,
      }),
    getNextPageParam: nextPageParam,
  })
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
