/**
 * useApiData — Hook that wraps TanStack Query for CRM components.
 * Provides loading, error, and empty states with automatic fallback to seed data.
 * Components call useApiData(queryKey, apiFn, { fallback: seedData }) —
 * renders the API response when the backend is available, falls back to seed data otherwise.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '@/contexts/TenantContext'

export function useApiData(queryKey, apiFn, options = {}) {
  const { tenant } = useTenant()
  const tenantKey = tenant?.slug || 'acme-bank'

  const fullKey = Array.isArray(queryKey) ? [...queryKey, tenantKey] : [queryKey, tenantKey]

  const query = useQuery({
    queryKey: fullKey,
    queryFn: apiFn,
    enabled: options.enabled !== false,
    staleTime: options.staleTime ?? 30_000,
    retry: options.retry ?? 1,
    ...options.queryOptions,
  })

  // Fall back to seed data when API is unavailable
  const data = query.data ?? options.fallback ?? null
  const isUsingFallback = !query.data && !!options.fallback

  return {
    data,
    isLoading: query.isLoading && !options.fallback,
    isError: query.isError && !options.fallback,
    error: query.error,
    isFetching: query.isFetching,
    isUsingFallback,
    refetch: query.refetch,
  }
}

export function useApiMutation(mutationFn, options = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (data, variables, context) => {
      if (options.invalidateKeys) {
        options.invalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }))
      }
      options.onSuccess?.(data, variables, context)
    },
    onError: options.onError,
  })
}

export function useTenantSlug() {
  const { tenant } = useTenant()
  return tenant?.slug || 'acme-bank'
}
