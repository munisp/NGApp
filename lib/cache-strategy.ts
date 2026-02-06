import type { UseQueryOptions } from '@tanstack/react-query';

type CachePreset = 'realtime' | 'frequent' | 'standard' | 'slow' | 'static';

interface CacheTTL {
  staleTime: number;
  gcTime: number;
  refetchInterval?: number;
}

const CACHE_PRESETS: Record<CachePreset, CacheTTL> = {
  realtime: {
    staleTime: 0,
    gcTime: 30_000,
    refetchInterval: 5_000,
  },
  frequent: {
    staleTime: 10_000,
    gcTime: 60_000,
    refetchInterval: 30_000,
  },
  standard: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  },
  slow: {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  },
  static: {
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  },
};

const QUERY_CACHE_MAP: Record<string, CachePreset> = {
  'transactions.list': 'frequent',
  'transactions.getById': 'standard',
  'accounts.list': 'standard',
  'accounts.getById': 'standard',
  'accounts.getBalance': 'frequent',
  'budgets.list': 'standard',
  'budgets.getById': 'standard',
  'budgets.getAnalytics': 'slow',
  'savingsGoals.list': 'standard',
  'savingsGoals.getById': 'standard',
  'creditScore.get': 'slow',
  'creditScore.getHistory': 'slow',
  'financialHealth.getScore': 'slow',
  'openBanking.getLinkedAccounts': 'standard',
  'notifications.list': 'frequent',
  'notifications.getUnreadCount': 'realtime',
  'billReminders.list': 'standard',
  'billReminders.getUpcoming': 'frequent',
  'bnpl.list': 'standard',
  'bnpl.getById': 'standard',
  'expenseCategories.list': 'slow',
  'profile.get': 'slow',
  'settings.get': 'static',
  'featureFlags.getAll': 'static',
};

export function getCacheOptions(queryKey: string): Partial<UseQueryOptions> {
  const preset = QUERY_CACHE_MAP[queryKey] || 'standard';
  return CACHE_PRESETS[preset];
}

export function getCachePreset(preset: CachePreset): CacheTTL {
  return CACHE_PRESETS[preset];
}
