/**
 * React Query (TanStack Query) configuration
 * Provides caching, background refetching, optimistic updates
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Query key factories for consistent cache invalidation
export const queryKeys = {
  customers: {
    all: ['customers'],
    lists: () => [...queryKeys.customers.all, 'list'],
    list: (params) => [...queryKeys.customers.lists(), params],
    details: () => [...queryKeys.customers.all, 'detail'],
    detail: (id) => [...queryKeys.customers.details(), id],
    profile: (id) => [...queryKeys.customers.details(), id, 'profile'],
    interactions: (id) => [...queryKeys.customers.details(), id, 'interactions'],
  },
  campaigns: {
    all: ['campaigns'],
    lists: () => [...queryKeys.campaigns.all, 'list'],
    list: (params) => [...queryKeys.campaigns.lists(), params],
    detail: (id) => [...queryKeys.campaigns.all, 'detail', id],
    metrics: (id) => [...queryKeys.campaigns.all, 'metrics', id],
  },
  analytics: {
    all: ['analytics'],
    segments: (params) => [...queryKeys.analytics.all, 'segments', params],
    lifecycle: (params) => [...queryKeys.analytics.all, 'lifecycle', params],
    value: (params) => [...queryKeys.analytics.all, 'value', params],
    churn: (params) => [...queryKeys.analytics.all, 'churn', params],
  },
  banking: {
    all: ['banking'],
    accounts: (params) => [...queryKeys.banking.all, 'accounts', params],
    transactions: (params) => [...queryKeys.banking.all, 'transactions', params],
    fraud: (params) => [...queryKeys.banking.all, 'fraud', params],
  },
  inventory: {
    all: ['inventory'],
    products: (params) => [...queryKeys.inventory.all, 'products', params],
    stock: (params) => [...queryKeys.inventory.all, 'stock', params],
  },
  audit: {
    all: ['audit'],
    logs: (params) => [...queryKeys.audit.all, 'logs', params],
  },
  security: {
    all: ['security'],
    dashboard: () => [...queryKeys.security.all, 'dashboard'],
    threats: (params) => [...queryKeys.security.all, 'threats', params],
    incidents: (params) => [...queryKeys.security.all, 'incidents', params],
  },
  tasks: {
    all: ['tasks'],
    list: (params) => [...queryKeys.tasks.all, 'list', params],
    detail: (id) => [...queryKeys.tasks.all, 'detail', id],
  },
  tenants: {
    all: ['tenants'],
    current: () => [...queryKeys.tenants.all, 'current'],
    settings: (id) => [...queryKeys.tenants.all, 'settings', id],
  },
  apiKeys: {
    all: ['apiKeys'],
  },
  webhooks: {
    all: ['webhooks'],
  },
  ai: {
    all: ['ai'],
    gnn: (params) => [...queryKeys.ai.all, 'gnn', params],
    mcmc: (params) => [...queryKeys.ai.all, 'mcmc', params],
    kgqa: (question) => [...queryKeys.ai.all, 'kgqa', question],
    graphrag: (question) => [...queryKeys.ai.all, 'graphrag', question],
    ollama: () => [...queryKeys.ai.all, 'ollama'],
  },
}
