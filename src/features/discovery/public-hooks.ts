import { useQuery } from '@tanstack/react-query'
import { api } from '~/api/client'
import { pageQuery } from '~/api/paging'
import type { EventSeatMap, PublicEvent, PublicEventPage } from '~/api/types'

/**
 * Everything here is anonymous. `anonymous: true` sends no bearer, so an expired token in
 * some other tab cannot turn a public page into a 401 - somebody browsing events has no
 * account yet, and the ones who do should not see a different site.
 */
export function usePublicEvents(filters: { city?: string }) {
  return useQuery({
    queryKey: ['public', 'events', filters.city ?? ''],
    queryFn: () =>
      api.get<PublicEventPage>(
        `/public/events?${pageQuery(undefined)}` +
          (filters.city ? `&city=${encodeURIComponent(filters.city)}` : ''),
        { anonymous: true },
      ),
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
