import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import type { PricingTier, PricingTierInput } from '~/api/types'

/**
 * Setting prices, which is a different shape from reading them.
 *
 * `PricingTier` carries a null price for a tier named on the Seat Map but not yet priced;
 * `PricingTierInput` does not, because a request with a null price would be asking to
 * unprice a tier and there is no such operation. The contract says so since
 * event-ticket-kb#7, and the generated types now make sending one impossible.
 */
export function useSetPricingTiers(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tiers: PricingTierInput[]) =>
      api.put<PricingTier[]>(`/events/${eventId}/pricing-tiers`, tiers),
    onSuccess: () => {
      // The Event carries its own copy of the tiers, so the detail has to be refetched
      // rather than patched from this response.
      void queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
