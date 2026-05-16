import { useState, useEffect, useCallback } from 'react';
import { offlineSyncService } from '../services/OfflineSync';
import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { apiClient } from '../services/api';

interface UseOfflineSyncOptions<T> {
  queryKey: QueryKey;
  endpoint: string;
  cacheKey: string;
  ttl?: number;
  enabled?: boolean;
}

export function useOfflineSync<T>({
  queryKey,
  endpoint,
  cacheKey,
  ttl = 24 * 60 * 60 * 1000,
  enabled = true,
}: UseOfflineSyncOptions<T>) {
  const [isOnline, setIsOnline] = useState(offlineSyncService.getNetworkStatus());
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = offlineSyncService.addNetworkListener((online) => {
      setIsOnline(online);
      if (online) {
        queryClient.invalidateQueries({ queryKey });
      }
    });

    return unsubscribe;
  }, [queryKey, queryClient]);

  const query = useQuery<T>({
    queryKey,
    queryFn: async () => {
      try {
        const response = await apiClient.get(endpoint);
        await offlineSyncService.cacheData(cacheKey, response.data, ttl);
        return response.data;
      } catch (error) {
        const cachedData = await offlineSyncService.getCachedData<T>(cacheKey);
        if (cachedData) {
          return cachedData;
        }
        throw error;
      }
    },
    enabled,
    staleTime: isOnline ? 5 * 60 * 1000 : Infinity,
    gcTime: 30 * 60 * 1000,
  });

  const prefetch = useCallback(async () => {
    const cachedData = await offlineSyncService.getCachedData<T>(cacheKey);
    if (cachedData) {
      queryClient.setQueryData(queryKey, cachedData);
    }
  }, [cacheKey, queryKey, queryClient]);

  useEffect(() => {
    prefetch();
  }, [prefetch]);

  return {
    ...query,
    isOnline,
    isCached: query.data !== undefined && !isOnline,
  };
}

interface UseOfflineMutationOptions<TData, TVariables> {
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  syncType: string;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  invalidateQueries?: QueryKey[];
}

export function useOfflineMutation<TData = unknown, TVariables = unknown>({
  endpoint,
  method,
  syncType,
  onSuccess,
  onError,
  invalidateQueries = [],
}: UseOfflineMutationOptions<TData, TVariables>) {
  const [isOnline, setIsOnline] = useState(offlineSyncService.getNetworkStatus());
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = offlineSyncService.addNetworkListener(setIsOnline);
    return unsubscribe;
  }, []);

  const mutation = useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      if (isOnline) {
        const response = await apiClient.request({
          url: endpoint,
          method,
          data: variables,
        });
        return response.data;
      } else {
        await offlineSyncService.addToSyncQueue({
          type: syncType,
          endpoint,
          method,
          data: variables,
        });
        return { queued: true, message: 'Action queued for sync' } as TData;
      }
    },
    onSuccess: (data) => {
      invalidateQueries.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    ...mutation,
    isOnline,
    isQueued: !isOnline,
  };
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(offlineSyncService.getNetworkStatus());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubscribe = offlineSyncService.addNetworkListener(setIsOnline);
    
    const checkPending = async () => {
      const queue = await offlineSyncService.getSyncQueue();
      setPendingCount(queue.length);
    };
    
    checkPending();
    const interval = setInterval(checkPending, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const syncNow = useCallback(async () => {
    if (isOnline) {
      await offlineSyncService.processSyncQueue();
      const queue = await offlineSyncService.getSyncQueue();
      setPendingCount(queue.length);
    }
  }, [isOnline]);

  return {
    isOnline,
    pendingCount,
    syncNow,
  };
}

export function usePoliciesOffline() {
  return useOfflineSync({
    queryKey: ['policies'],
    endpoint: '/policies',
    cacheKey: 'policies',
  });
}

export function useClaimsOffline() {
  return useOfflineSync({
    queryKey: ['claims'],
    endpoint: '/claims',
    cacheKey: 'claims',
  });
}

export function usePaymentsOffline() {
  return useOfflineSync({
    queryKey: ['payments'],
    endpoint: '/payments',
    cacheKey: 'payments',
  });
}

export function useProfileOffline() {
  return useOfflineSync({
    queryKey: ['profile'],
    endpoint: '/profile',
    cacheKey: 'profile',
  });
}

export function useNotificationsOffline() {
  return useOfflineSync({
    queryKey: ['notifications'],
    endpoint: '/notifications',
    cacheKey: 'notifications',
  });
}

export function useCreateClaimOffline() {
  return useOfflineMutation({
    endpoint: '/claims',
    method: 'POST',
    syncType: 'CREATE_CLAIM',
    invalidateQueries: [['claims']],
  });
}

export function useUpdateProfileOffline() {
  return useOfflineMutation({
    endpoint: '/profile',
    method: 'PUT',
    syncType: 'UPDATE_PROFILE',
    invalidateQueries: [['profile']],
  });
}
