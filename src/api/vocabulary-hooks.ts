import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { Category, City } from './types'

/**
 * The Category and City sets the platform defines (requirements/009 criteria 12 and 13).
 *
 * Anonymous, like everything else a visitor reads. Neither set is tenant-scoped - every
 * organizer sees the same six categories and so does somebody with no account - which is what
 * makes them readable here at all.
 *
 * Beside the client rather than inside a feature, because discovery filters by these, the
 * venue form picks a City from them and the event form picks a Category - three features and
 * one vocabulary.
 *
 * Held for the session rather than refetched. They change when a migration or an administrator
 * changes them, which is not something a browsing visitor will see happen, and a filter strip
 * that re-requested its own labels on every navigation would be spending requests to learn
 * nothing. `staleTime: Infinity` says that outright instead of picking a number that reads as
 * a guess.
 */
export function useCategories() {
  return useQuery({
    queryKey: ['public', 'categories'],
    queryFn: () => api.get<Category[]>('/public/categories', { anonymous: true }),
    staleTime: Infinity,
  })
}

export function useCities() {
  return useQuery({
    queryKey: ['public', 'cities'],
    queryFn: () => api.get<City[]>('/public/cities', { anonymous: true }),
    staleTime: Infinity,
  })
}
