import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { useSessionState } from '~/features/auth/session-hooks'
import type { Membership, Role } from '~/api/types'

/**
 * The people in the **active** Organization.
 *
 * The path carries no organization id, and that is ADR-0004 working: row-level security has
 * already narrowed the table to the Organization named in the token. Which is exactly why the
 * active id is in the query key even though it is in no URL - without it, switching
 * organizations would show the previous one's team from cache, on the one screen where acting
 * on the wrong list adds a stranger to somebody else's events.
 */
export function useMembers() {
  const { organizationId } = useSessionState()
  return useQuery({
    queryKey: ['organization', organizationId ?? 'none', 'members'],
    queryFn: () => api.get<Membership[]>('/organization/members'),
    enabled: organizationId !== null,
  })
}

/**
 * requirements/001 criteria 7 and 8. The Membership is created now and the person may not have
 * an account yet: the server makes a shell User for the address, emails them, and their access
 * starts working when they verify it. So there is no invitation to accept and nothing to
 * expire - which is why this returns a Membership and not an invite.
 */
export function useInviteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; role: Role }) =>
      api.post<Membership>('/organization/members', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organization'] }),
  })
}

export function useChangeMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; role: Role }) =>
      api.patch<Membership>(`/organization/members/${input.userId}`, { role: input.role }),
    // `/me` too: the caller may have just changed their own role, and every screen that decides
    // what to offer reads their Memberships from there rather than from the token (ADR-0005).
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/**
 * requirements/001 criterion 9. Immediate at the door - the scan endpoint checks live
 * Membership rather than trusting the token - and within the token's lifetime everywhere else.
 */
export function useRemoveMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.delete<void>(`/organization/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
