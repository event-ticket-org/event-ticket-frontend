import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import type { Organization, OrganizationPage, OrganizationStatus } from '~/api/types'

/**
 * Platform administration is not tenant-scoped: an administrator acts on Organizations
 * rather than within one, so nothing here depends on the active Organization.
 *
 * Keyset pagination, following `nextCursor` until it is absent. The backend pages this way
 * because an offset shifts under inserts, and organizations are created while somebody is
 * working through the queue.
 */
export function useOrganizations(status: OrganizationStatus) {
  return useInfiniteQuery({
    queryKey: ['admin', 'organizations', status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<OrganizationPage>(
        `/admin/organizations?status=${status}&limit=20` +
          (pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''),
      ),
    getNextPageParam: nextPageParam,
  })
}

/**
 * `null` and absent both mean "no further pages", and only a string continues.
 *
 * Worth its own function and its own test: TanStack Query treats *any* value that is not
 * `undefined` as another page, so returning `null` straight from the body asks for the same
 * page for ever. The backend really does answer `"nextCursor": null` on the last page.
 */
export function nextPageParam(page: OrganizationPage): string | undefined {
  return page.nextCursor ?? undefined
}

export function useDecideOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (decision: { id: string; decision: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      api.post<Organization>(`/admin/organizations/${decision.id}/decision`, {
        decision: decision.decision,
        reason: decision.reason,
      }),
    // Every list is affected: the row leaves the pending queue and joins another.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] }),
  })
}
