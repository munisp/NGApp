import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Custom hook for fetching and managing pilot dashboard metrics
 * 
 * Features:
 * - WebSocket connection for real-time updates (30-second refresh)
 * - Fallback to HTTP polling if WebSocket is unavailable
 * - Automatic reconnection on connection loss
 * - Error handling and retry logic
 * 
 * Usage:
 * ```tsx
 * const { metrics, loading, error, refreshMetrics } = useDashboardMetrics();
 * ```
 */

interface DashboardMetrics {
  // Application Metrics
  total_applications: number;
  pending_applications: number;
  approved_applications: number;
  rejected_applications: number;
  approval_rate: number;
  avg_processing_time_hours: number;
  
  // Disbursement Metrics
  total_disbursed: number;
  disbursement_count: number;
  avg_loan_amount: number;
  pending_disbursements: number;
  
  // Repayment Metrics
  total_repaid: number;
  repayment_count: number;
  on_time_repayment_rate: number;
  outstanding_balance: number;
  
  // Default Metrics
  default_count: number;
  default_rate: number;
  total_default_amount: number;
  recovery_rate: number;
  
  // Tier Graduation Metrics
  tier1_users: number;
  tier2_users: number;
  tier3_users: number;
  tier4_users: number;
  tier5_users: number;
  graduation_count: number;
  avg_credit_score_improvement: number;
  
  // User Engagement Metrics
  active_users: number;
  new_users_today: number;
  avg_loans_per_user: number;
  
  // Financial Metrics
  total_revenue: number;
  total_interest_earned: number;
  net_profit_margin: number;
  
  // Timestamp
  as_of: string;
}

const DASHBOARD_API_URL = 'http://localhost:8083/api/v1/dashboard';
const DASHBOARD_WS_URL = 'ws://localhost:8083/api/v1/dashboard/ws';

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Fetch metrics via HTTP (fallback)
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${DASHBOARD_API_URL}/metrics`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setMetrics(data);
      setError(null);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch metrics';
      setError(errorMessage);
      console.error('Error fetching dashboard metrics:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    // WebSocket not supported on web in development
    if (Platform.OS === 'web') {
      console.log('WebSocket not supported on web, using HTTP polling');
      return;
    }

    try {
      const ws = new WebSocket(DASHBOARD_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Dashboard WebSocket connected');
        reconnectAttemptsRef.current = 0;
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMetrics(data);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('Dashboard WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('Dashboard WebSocket disconnected');
        wsRef.current = null;

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectWebSocket();
          }, delay);
        } else {
          console.log('Max reconnection attempts reached, falling back to HTTP polling');
          setError('Real-time updates unavailable, using manual refresh');
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket connection:', err);
      setError('Failed to establish real-time connection');
    }
  }, []);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Manual refresh
  const refreshMetrics = useCallback(async () => {
    setLoading(true);
    try {
      await fetchMetrics();
    } catch (err) {
      // Error already handled in fetchMetrics
    }
  }, [fetchMetrics]);

  // Initialize
  useEffect(() => {
    // Initial fetch
    fetchMetrics();

    // Try WebSocket connection (will fall back to HTTP polling on web)
    connectWebSocket();

    // HTTP polling fallback (every 30 seconds)
    const pollingInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchMetrics();
      }
    }, 30000);

    // Cleanup
    return () => {
      disconnectWebSocket();
      clearInterval(pollingInterval);
    };
  }, [fetchMetrics, connectWebSocket, disconnectWebSocket]);

  return {
    metrics,
    loading,
    error,
    refreshMetrics,
  };
}
