/**
 * React hooks for Lakehouse API integration
 * Provides real-time data fetching and WebSocket updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
import { createLogger } from '@/lib/logger';
const log = createLogger('useLakehouse');
  lakehouseAPI,
  NOCMetrics,
  FraudMetrics,
  SettlementMetrics,
  ParticipantMetrics,
  ReportsMetrics,
  DeveloperMetrics,
} from '@/lib/api';

// Generic hook for fetching lakehouse data with auto-refresh
export function useLakehouseQuery<T>(
  queryFn: () => Promise<T>,
  options: {
    refreshInterval?: number;
    enabled?: boolean;
    onError?: (error: Error) => void;
  } = {}
) {
  const { refreshInterval = 30000, enabled = true, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      const result = await queryFn();
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      const err = e as Error;
      setError(err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [queryFn, enabled, onError]);

  useEffect(() => {
    fetchData();
    
    if (refreshInterval > 0 && enabled) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, enabled]);

  return { data, loading, error, lastUpdated, refetch: fetchData };
}

// Hook for NOC Dashboard metrics
export function useNOCMetrics(refreshInterval = 5000) {
  return useLakehouseQuery<NOCMetrics>(
    () => lakehouseAPI.getNOCMetrics(),
    { refreshInterval }
  );
}

// Hook for Fraud Dashboard metrics
export function useFraudMetrics(refreshInterval = 10000) {
  return useLakehouseQuery<FraudMetrics>(
    () => lakehouseAPI.getFraudMetrics(),
    { refreshInterval }
  );
}

// Hook for Settlement Dashboard metrics
export function useSettlementMetrics(refreshInterval = 15000) {
  return useLakehouseQuery<SettlementMetrics>(
    () => lakehouseAPI.getSettlementMetrics(),
    { refreshInterval }
  );
}

// Hook for Participant Management metrics
export function useParticipantMetrics(refreshInterval = 30000) {
  return useLakehouseQuery<ParticipantMetrics>(
    () => lakehouseAPI.getParticipantMetrics(),
    { refreshInterval }
  );
}

// Hook for Reports metrics
export function useReportsMetrics(refreshInterval = 60000) {
  return useLakehouseQuery<ReportsMetrics>(
    () => lakehouseAPI.getReportsMetrics(),
    { refreshInterval }
  );
}

// Hook for Developer Portal metrics
export function useDeveloperMetrics(refreshInterval = 30000) {
  return useLakehouseQuery<DeveloperMetrics>(
    () => lakehouseAPI.getDeveloperMetrics(),
    { refreshInterval }
  );
}

// Real-time metrics from WebSocket
export interface RealtimeMetrics {
  tps: number;
  success_rate: number;
  avg_latency_ms: number;
  active_transactions: number;
  timestamp: string;
}

// Hook for real-time WebSocket updates
export function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = (process.env.NEXT_PUBLIC_LAKEHOUSE_API_URL || 'http://localhost:8080')
      .replace('http', 'ws') + '/ws/realtime';
    
    const connect = () => {
      try {
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          setConnected(true);
          log.info('WebSocket connected');
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'realtime_metrics') {
              setMetrics(data.data);
            }
          } catch (e) {
            log.error('WebSocket message parse error:', e);
          }
        };
        
        wsRef.current.onerror = (error) => {
          log.error('WebSocket error:', error);
        };
        
        wsRef.current.onclose = () => {
          setConnected(false);
          log.info('WebSocket disconnected, reconnecting...');
          setTimeout(connect, 5000);
        };
      } catch (e) {
        log.error('WebSocket connection error:', e);
        setTimeout(connect, 5000);
      }
    };
    
    connect();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send('ping');
    }
  }, []);

  return { metrics, connected, sendPing };
}

// Hook for kill switch actions
export function useKillSwitch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activate = useCallback(async (switchId: string, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      await lakehouseAPI.activateKillSwitch(switchId, reason);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const deactivate = useCallback(async (switchId: string) => {
    setLoading(true);
    setError(null);
    try {
      await lakehouseAPI.deactivateKillSwitch(switchId);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { activate, deactivate, loading, error };
}

// Hook for settlement actions
export function useSettlementActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const approve = useCallback(async (settlementId: string) => {
    setLoading(true);
    setError(null);
    try {
      await lakehouseAPI.approveSettlement(settlementId);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const reject = useCallback(async (settlementId: string, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      await lakehouseAPI.rejectSettlement(settlementId, reason);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { approve, reject, loading, error };
}

// Hook for fraud alert actions
export function useFraudAlertActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const resolve = useCallback(async (alertId: string, resolution: string) => {
    setLoading(true);
    setError(null);
    try {
      await lakehouseAPI.resolveFraudAlert(alertId, resolution);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { resolve, loading, error };
}

// Hook for analytics queries
export function useAnalytics() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getTransactionAnalytics = useCallback(async (startDate?: string, endDate?: string, participant?: string) => {
    setLoading(true);
    setError(null);
    try {
      return await lakehouseAPI.getTransactionAnalytics(startDate, endDate, participant);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const getFraudAnalytics = useCallback(async (startDate?: string, endDate?: string) => {
    setLoading(true);
    setError(null);
    try {
      return await lakehouseAPI.getFraudAnalytics(startDate, endDate);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSettlementAnalytics = useCallback(async (startDate?: string, endDate?: string) => {
    setLoading(true);
    setError(null);
    try {
      return await lakehouseAPI.getSettlementAnalytics(startDate, endDate);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    getTransactionAnalytics,
    getFraudAnalytics,
    getSettlementAnalytics,
    loading,
    error,
  };
}
