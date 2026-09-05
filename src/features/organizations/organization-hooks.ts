import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { session } from '~/api/session'
import type { Organization, TokenPair } from '~/api/types'

/**
 * Creating an Organization makes the caller its Owner, and the server refuses if their email
 * is not confirmed (`EMAIL_NOT_VERIFIED`).
 *
 * Two requests, not one, and the second is the point: a new Membership does not exist in the
 * access token the browser is holding, and the active Organization is a claim inside that
 * token rather than a parameter on a request (ADR-0004). Without the switch the person is an
 * Owner the application cannot see, looking at the same empty state they just left.
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const organization = await api.post<Organization>('/organizations', input)
      const tokens = await api.post<TokenPair>('/auth/switch-organization', {
        organizationId: organization.id,
      })
      session.adopt(tokens)
      return organization
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
