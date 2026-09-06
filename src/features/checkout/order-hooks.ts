import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { nextPageParam, pageQuery } from '~/api/paging'
import type { Order, OrderPage, PaymentSession, Ticket } from '~/api/types'

export function useOrders() {
  return useInfiniteQuery({
    queryKey: ['orders'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.get<OrderPage>(`/orders?${pageQuery(pageParam)}`),
    getNextPageParam: nextPageParam,
  })
}

/**
 * One Order, polled while it is waiting to be paid.
 *
 * requirements/005 criterion 3: an Order becomes paid only on a provider confirmation, and
 * the buyer returning to the site never confirms one. So the page cannot know it has been
 * paid by anything the buyer does - it has to ask. Polling stops the moment the answer is no
 * longer going to change.
 */
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => api.get<Order>(`/orders/${orderId}`),
    enabled: orderId !== '',
    refetchInterval: (query) =>
      query.state.data?.status === 'AWAITING_PAYMENT' ? 3_000 : false,
  })
}

export function useOrderTickets(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['orders', orderId, 'tickets'],
    queryFn: () => api.get<Ticket[]>(`/orders/${orderId}/tickets`),
    enabled: enabled && orderId !== '',
  })
}

/**
 * Takes the Seat Holds and creates the Order. This is where the clock starts.
 *
 * A 409 names the seats that went in `details.seatIds`, and the caller drops exactly those
 * (requirements/004 criterion 6) rather than making somebody rebuild a selection that is
 * still almost entirely valid.
 */
export function useCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { eventId: string; seatIds: string[] }) =>
      api.post<Order>('/checkout', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}

/**
 * requirements/004 criterion 11: abandoning releases the holds at once rather than leaving
 * the seats dark for the rest of the ten minutes.
 */
export function useAbandonOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => api.delete<void>(`/orders/${orderId}`),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/**
 * Starts an attempt and returns what the buyer must do next.
 *
 * An Order has many attempts and at most one success (criterion 11), so this can be called
 * again while the holds are alive - a buyer who closed the QR, or whose transfer failed,
 * gets another one rather than a dead order.
 */
export function useStartPayment(orderId: string) {
  return useMutation({
    mutationFn: (provider: string) =>
      api.post<PaymentSession>(`/orders/${orderId}/payment-sessions`, { provider }),
  })
}

export function useResendOrderEmail(orderId: string) {
  return useMutation({
    mutationFn: () => api.post<void>(`/orders/${orderId}/resend-email`),
  })
}
