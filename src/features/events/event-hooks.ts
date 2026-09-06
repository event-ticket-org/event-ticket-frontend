import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { nextPageParam, pageQuery } from '~/api/paging'
import type { Event, EventInput, EventPage, EventPatch, EventStatus } from '~/api/types'

export function useEvents(status: EventStatus | 'ALL') {
  return useInfiniteQuery({
    queryKey: ['events', status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<EventPage>(
        `/events?${pageQuery(pageParam)}${status === 'ALL' ? '' : `&status=${status}`}`,
      ),
    getNextPageParam: nextPageParam,
  })
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['events', 'detail', eventId],
    queryFn: () => api.get<Event>(`/events/${eventId}`),
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EventInput) => api.post<Event>('/events', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

/**
 * Only the fields that changed are sent.
 *
 * The server decides what a published Event will still accept, and sending an unchanged
 * value back is how a PATCH accidentally becomes a reschedule - `UpdateEvent` treats any
 * `startsAt` different from the stored one as a move, audits it, and notifies ticket holders.
 */
export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: EventPatch) => api.patch<Event>(`/events/${eventId}`, patch),
    onSuccess: (event) => {
      queryClient.setQueryData(['events', 'detail', eventId], event)
      void queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

export function usePublishEvent(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<Event>(`/events/${eventId}/publish`),
    onSuccess: (event) => {
      queryClient.setQueryData(['events', 'detail', eventId], event)
      void queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

export function useCloseSales(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<Event>(`/events/${eventId}/close-sales`),
    onSuccess: (event) => {
      queryClient.setQueryData(['events', 'detail', eventId], event)
      void queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
