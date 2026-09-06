import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { nextPageParam, pageQuery } from '~/api/paging'
import type { EventCancellation, OrderPage, OrderStatus, Refund } from '~/api/types'

export type OrderFilter = { status?: OrderStatus; refundRequired?: boolean }

/**
 * The Orders an Event sold, for the Owner or Manager deciding what to do about one.
 *
 * Not `useOrders`, which is the buyer's own list across every Organization and answers a
 * different question. This one carries the buyer's address and the `refundRequired` flag,
 * because it is read by somebody who may have to answer to the person named on it.
 */
export function useEventOrders(eventId: string, filter: OrderFilter) {
  const query =
    (filter.status ? `&status=${filter.status}` : '') +
    (filter.refundRequired === undefined ? '' : `&refundRequired=${filter.refundRequired}`)

  return useInfiniteQuery({
    queryKey: ['events', eventId, 'orders', filter.status ?? '', filter.refundRequired ?? ''],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<OrderPage>(`/events/${eventId}/orders?${pageQuery(pageParam)}${query}`),
    getNextPageParam: nextPageParam,
    enabled: eventId !== '',
  })
}

/**
 * requirements/008 criteria 1 and 2. Answers 202 with a `REFUND_PENDING` Refund: the money has
 * been asked for and has not moved, and the provider says when it does.
 *
 * Everything is invalidated rather than the Order alone. Refunding voids the Order's Tickets
 * and, once it settles, puts its seats back on sale - so an events list showing a sold count,
 * a seat map showing availability and the Order itself are all now wrong, and naming them one
 * by one is how one of them gets forgotten.
 */
export function useRefundOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { orderId: string; reason: string }) =>
      api.post<Refund>(`/orders/${input.orderId}/refunds`, { reason: input.reason }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/**
 * Every attempt against an Order, newest first.
 *
 * More than one is normal rather than an error: a refund the provider refused is kept, with
 * its reason, and a second attempt is made beside it. The history is what says whether the
 * money ever actually moved.
 */
export function useOrderRefunds(orderId: string, enabled = true) {
  return useQuery({
    queryKey: ['orders', orderId, 'refunds'],
    queryFn: () => api.get<Refund[]>(`/orders/${orderId}/refunds`),
    enabled: enabled && orderId !== '',
  })
}

export function useCancelEvent(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) =>
      api.post<EventCancellation>(`/events/${eventId}/cancel`, { reason }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/**
 * How a cancellation is going, per Order (criterion 7).
 *
 * Polled while anything is still pending and left alone once nothing is, because this is the
 * one screen in the manager shell somebody sits and watches - a bulk refund that partially
 * fails is the reason the endpoint reports per Order at all, and the failures are what they
 * are waiting to see.
 *
 * A 404 is the ordinary answer for an Event nobody has cancelled, so this is only asked when
 * one has been.
 */
export function useEventCancellation(eventId: string, cancelled: boolean) {
  return useQuery({
    queryKey: ['events', eventId, 'cancellation'],
    queryFn: () => api.get<EventCancellation>(`/events/${eventId}/cancel`),
    enabled: cancelled && eventId !== '',
    refetchInterval: (query) => ((query.state.data?.pending ?? 0) > 0 ? 3_000 : false),
  })
}
