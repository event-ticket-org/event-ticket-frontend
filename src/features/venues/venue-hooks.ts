import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import type { SeatMap, Venue, VenueInput } from '~/api/types'

/** Venues are few and unpaginated in the contract - one array, no cursor. */
export function useVenues() {
  return useQuery({ queryKey: ['venues'], queryFn: () => api.get<Venue[]>('/venues') })
}

export function useVenue(venueId: string) {
  return useQuery({
    queryKey: ['venues', venueId],
    queryFn: () => api.get<Venue>(`/venues/${venueId}`),
  })
}

export function useCreateVenue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VenueInput) => api.post<Venue>('/venues', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useUpdateVenue(venueId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VenueInput) => api.patch<Venue>(`/venues/${venueId}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useDeleteVenue() {
  const queryClient = useQueryClient()
  return useMutation({
    // A Venue with a published Event is refused with VENUE_IN_USE. Knowing that in advance
    // would need either a contract change or a client-side scan of every Event, and the
    // refusal is safe, loses nothing, and arrives with a message worth reading.
    mutationFn: (venueId: string) => api.delete<void>(`/venues/${venueId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useSeatMap(venueId: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'seat-map'],
    queryFn: () => api.get<SeatMap>(`/venues/${venueId}/seat-map`),
  })
}

/**
 * The whole map goes in one request.
 *
 * requirements/002: editing a 2,000-seat map is a bulk edit, and one atomic replacement is
 * simpler to reason about than a stream of granular operations - there is no add-seat or
 * move-seat endpoint to keep consistent with anything.
 *
 * The consequence for the editor is that it holds a draft and saves deliberately, and that a
 * single bad seat rejects every good one, which is why the editor validates as you go.
 */
export function useReplaceSeatMap(venueId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (map: SeatMap) => api.put<SeatMap>(`/venues/${venueId}/seat-map`, map),
    onSuccess: (saved) => {
      queryClient.setQueryData(['venues', venueId, 'seat-map'], saved)
      // seatCount lives on the Venue, so the list is now stale.
      void queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
