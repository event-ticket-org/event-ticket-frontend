import { useCallback, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { session } from '~/api/session'
import type { Me, Organization, TokenPair } from '~/api/types'

/** Re-renders when tokens change, without a context provider wrapping the tree. */
export function useSessionState() {
  const subscribe = useCallback((listener: () => void) => session.subscribe(listener), [])
  const snapshot = useCallback(() => session.access ?? session.refresh ?? null, [])
  const credential = useSyncExternalStore(subscribe, snapshot)
  return { signedIn: credential !== null, organizationId: session.organizationId }
}

/**
 * Who the caller is, according to the server.
 *
 * Read from `/me` rather than from the token, deliberately. The token says which
 * Organization is active; the server says which Memberships still exist, and those are
 * not the same thing - a removed member holds a valid token for up to fifteen minutes
 * (ADR-0005). Anything that decides what a person may *do* asks the server.
 */
export function useMe() {
  const { signedIn } = useSessionState()
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/me'),
    enabled: signedIn,
    staleTime: 30_000,
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: { email: string; password: string; displayName: string }) =>
      api.post<void>('/auth/register', input, { anonymous: true }),
  })
}

/**
 * Verifying an email address signs you in - the response is a token pair, not an
 * acknowledgement - so somebody following the link from their inbox lands in the
 * application rather than on a sign-in form.
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) =>
      api.post<TokenPair>('/auth/verify-email', { token }, { anonymous: true }),
    onSuccess: (tokens) => {
      session.adopt(tokens)
      void queryClient.invalidateQueries()
    },
  })
}

export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<TokenPair>('/auth/login', input, { anonymous: true }),
    onSuccess: (tokens) => {
      session.adopt(tokens)
      void queryClient.invalidateQueries()
    },
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    // Whether or not the server heard us, this browser is signed out. A failed logout
    // that left someone looking signed in would be the worse of the two outcomes.
    onSettled: () => {
      session.clear()
      queryClient.clear()
    },
  })
}

/**
 * Switching Organization reissues the token, because the active Organization is a claim
 * inside it and never a parameter on a request - which is the whole of ADR-0004's
 * defence against reading another tenant's data by changing an id in a URL.
 */
export function useSwitchOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (organization: Pick<Organization, 'id'>) =>
      api.post<TokenPair>('/auth/switch-organization', { organizationId: organization.id }),
    onSuccess: (tokens) => {
      session.adopt(tokens)
      void queryClient.invalidateQueries()
    },
  })
}
