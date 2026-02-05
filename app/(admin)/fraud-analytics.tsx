import { ScrollView, Text, View, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { fraudDetectionAPI } from '@/lib/api/fraud-detection';
import { useColors } from '@/hooks/use-colors';

/**
 * Fraud Analytics Admin Dashboard
 * Real-time fraud detection metrics and flagged transactions
 */

interface FraudMetrics {
  totalTransactions: number;
  fraudDetected: number;
  fraudRate: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  avgProcessingTime: number;
  blockedTransactions: number;
  manualReviewPending: number;
}

interface FlaggedTransaction {
  id: string;
  amount: number;
  fromAccount: string;
  toAccount: string;
  riskScore: number;
  recommendedAction: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function FraudAnalyticsScreen() {
  const colors = useColors();
  const [metrics, setMetrics] = useState<FraudMetrics>({
    totalTransactions: 0,
    fraudDetected: 0,
    fraudRate: 0,
    falsePositiveRate: 0,
    falseNegativeRate: 0,
    avgProcessingTime: 0,
    blockedTransactions: 0,
    manualReviewPending: 0,
  });
  const [flaggedTransactions, setFlaggedTransactions] = useState<FlaggedTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // In production, fetch from API
      // For now, use mock data
      setMetrics({
        totalTransactions: 15420,
        fraudDetected: 856,
        fraudRate: 5.55,
        falsePositiveRate: 2.3,
        falseNegativeRate: 0.8,
        avgProcessingTime: 67,
        blockedTransactions: 234,
        manualReviewPending: 45,
      });

      setFlaggedTransactions([
        {
          id: 'txn_001',
          amount: 25000,
          fromAccount: 'acc_123456',
          toAccount: 'acc_789012',
          riskScore: 0.92,
          recommendedAction: 'BLOCK_TRANSACTION',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          status: 'pending',
        },
        {
          id: 'txn_002',
          amount: 8500,
          fromAccount: 'acc_234567',
          toAccount: 'acc_890123',
          riskScore: 0.78,
          recommendedAction: 'MANUAL_REVIEW',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          status: 'pending',
        },
        {
          id: 'txn_003',
          amount: 15000,
          fromAccount: 'acc_345678',
          toAccount: 'acc_901234',
          riskScore: 0.65,
          recommendedAction: 'ADDITIONAL_VERIFICATION',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          status: 'pending',
        },
      ]);
    } catch (error) {
      console.error('Failed to load fraud analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getRiskColor = (riskScore: number): string => {
    if (riskScore >= 0.9) return '#DC2626'; // red-600
    if (riskScore >= 0.7) return '#EA580C'; // orange-600
    if (riskScore >= 0.5) return '#F59E0B'; // amber-500
    return '#16A34A'; // green-600
  };

  const getRiskLabel = (riskScore: number): string => {
    if (riskScore >= 0.9) return 'Critical';
    if (riskScore >= 0.7) return 'High';
    if (riskScore >= 0.5) return 'Medium';
    return 'Low';
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const handleReviewTransaction = async (txId: string, action: 'approve' | 'reject') => {
    try {
      // In production, call API to approve/reject
      console.log(`${action} transaction ${txId}`);
      
      // Update local state
      setFlaggedTransactions(prev =>
        prev.map(tx =>
          tx.id === txId
            ? { ...tx, status: action === 'approve' ? 'approved' : 'rejected' }
            : tx
        )
      );
    } catch (error) {
      console.error(`Failed to ${action} transaction:`, error);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="p-6 justify-center items-center">
        <Text className="text-foreground text-lg">Loading analytics...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Fraud Analytics</Text>
          <Text className="text-muted">Real-time fraud detection metrics and flagged transactions</Text>
        </View>

        {/* Key Metrics */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-foreground mb-4">Key Metrics</Text>
          
          <View className="flex-row flex-wrap gap-3">
            {/* Total Transactions */}
            <View className="bg-surface rounded-xl p-4 flex-1 min-w-[45%] border border-border">
              <Text className="text-muted text-sm mb-1">Total Transactions</Text>
              <Text className="text-foreground text-2xl font-bold">{metrics.totalTransactions.toLocaleString()}</Text>
            </View>

            {/* Fraud Detected */}
            <View className="bg-surface rounded-xl p-4 flex-1 min-w-[45%] border border-border">
              <Text className="text-muted text-sm mb-1">Fraud Detected</Text>
              <Text className="text-2xl font-bold" style={{ color: '#EF4444' }}>
                {metrics.fraudDetected.toLocaleString()}
              </Text>
              <Text className="text-muted text-xs mt-1">{metrics.fraudRate.toFixed(2)}% of total</Text>
            </View>

            {/* Blocked */}
            <View className="bg-surface rounded-xl p-4 flex-1 min-w-[45%] border border-border">
              <Text className="text-muted text-sm mb-1">Blocked</Text>
              <Text className="text-2xl font-bold" style={{ color: '#DC2626' }}>
                {metrics.blockedTransactions.toLocaleString()}
              </Text>
            </View>

            {/* Pending Review */}
            <View className="bg-surface rounded-xl p-4 flex-1 min-w-[45%] border border-border">
              <Text className="text-muted text-sm mb-1">Pending Review</Text>
              <Text className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                {metrics.manualReviewPending}
              </Text>
            </View>

            {/* Avg Processing Time */}
            <View className="bg-surface rounded-xl p-4 flex-1 min-w-[45%] border border-border">
              <Text className="text-muted text-sm mb-1">Avg Processing Time</Text>
              <Text className="text-foreground text-2xl font-bold">{metrics.avgProcessingTime}ms</Text>
            </View>

            {/* False Positive Rate */}
            <View className="bg-surface rounded-xl p-4 flex-1 min-w-[45%] border border-border">
              <Text className="text-muted text-sm mb-1">False Positive Rate</Text>
              <Text className="text-foreground text-2xl font-bold">{metrics.falsePositiveRate}%</Text>
            </View>
          </View>
        </View>

        {/* Flagged Transactions */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-foreground mb-4">
            Flagged Transactions ({flaggedTransactions.filter(t => t.status === 'pending').length})
          </Text>

          {flaggedTransactions.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 border border-border items-center">
              <Text className="text-muted">No flagged transactions</Text>
            </View>
          ) : (
            flaggedTransactions.map((tx) => (
              <View
                key={tx.id}
                className="bg-surface rounded-xl p-4 mb-3 border border-border"
              >
                {/* Transaction Header */}
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-lg">
                      ${tx.amount.toLocaleString()}
                    </Text>
                    <Text className="text-muted text-sm">{tx.id}</Text>
                  </View>
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: `${getRiskColor(tx.riskScore)}20` }}
                  >
                    <Text style={{ color: getRiskColor(tx.riskScore), fontWeight: '600' }}>
                      {getRiskLabel(tx.riskScore)} Risk
                    </Text>
                  </View>
                </View>

                {/* Transaction Details */}
                <View className="mb-3">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-muted text-sm">From:</Text>
                    <Text className="text-foreground text-sm font-mono">{tx.fromAccount}</Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-muted text-sm">To:</Text>
                    <Text className="text-foreground text-sm font-mono">{tx.toAccount}</Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-muted text-sm">Risk Score:</Text>
                    <Text className="text-foreground text-sm font-semibold">
                      {(tx.riskScore * 100).toFixed(0)}%
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-muted text-sm">Time:</Text>
                    <Text className="text-foreground text-sm">{formatTime(tx.timestamp)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-muted text-sm">Action:</Text>
                    <Text className="text-foreground text-sm font-semibold">
                      {tx.recommendedAction.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                {tx.status === 'pending' && (
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      className="flex-1 bg-green-600 rounded-lg py-3 items-center"
                      onPress={() => handleReviewTransaction(tx.id, 'approve')}
                    >
                      <Text className="text-white font-semibold">Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 bg-red-600 rounded-lg py-3 items-center"
                      onPress={() => handleReviewTransaction(tx.id, 'reject')}
                    >
                      <Text className="text-white font-semibold">Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {tx.status !== 'pending' && (
                  <View
                    className="py-2 rounded-lg items-center"
                    style={{
                      backgroundColor:
                        tx.status === 'approved' ? '#16A34A20' : '#DC262620',
                    }}
                  >
                    <Text
                      style={{
                        color: tx.status === 'approved' ? '#16A34A' : '#DC2626',
                        fontWeight: '600',
                      }}
                    >
                      {tx.status.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Model Performance */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-foreground mb-4">Model Performance</Text>
          
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="mb-3">
              <View className="flex-row justify-between mb-2">
                <Text className="text-muted">False Positive Rate</Text>
                <Text className="text-foreground font-semibold">{metrics.falsePositiveRate}%</Text>
              </View>
              <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <View
                  className="h-full bg-yellow-500"
                  style={{ width: `${metrics.falsePositiveRate * 10}%` }}
                />
              </View>
            </View>

            <View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-muted">False Negative Rate</Text>
                <Text className="text-foreground font-semibold">{metrics.falseNegativeRate}%</Text>
              </View>
              <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <View
                  className="h-full bg-red-500"
                  style={{ width: `${metrics.falseNegativeRate * 10}%` }}
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
