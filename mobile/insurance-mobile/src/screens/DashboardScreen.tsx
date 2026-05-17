/**
 * Dashboard Screen — Insurance Platform Mobile
 * Shows: policy summary, pending claims, next payment, recent activity
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { apiClient, ActivityItem, DashboardSummary } from '../services/api';
import { useAppSelector } from '../store/hooks';

const COLORS = {
  primary: '#1E40AF',
  secondary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
};

function MetricCard({
  title,
  value,
  subtitle,
  color,
  onPress,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.metricCard, { borderLeftColor: color }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const statusColor = {
    active: COLORS.success,
    approved: COLORS.success,
    completed: COLORS.success,
    pending: COLORS.warning,
    under_review: COLORS.warning,
    rejected: COLORS.danger,
    failed: COLORS.danger,
    cancelled: COLORS.danger,
  }[item.status] ?? COLORS.textSecondary;

  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityDot, { backgroundColor: statusColor }]} />
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activityDescription}>{item.description}</Text>
        <Text style={styles.activityTime}>
          {format(new Date(item.timestamp), 'MMM d, yyyy HH:mm')}
        </Text>
      </View>
      <View style={[styles.activityBadge, { backgroundColor: statusColor + '20' }]}>
        <Text style={[styles.activityBadgeText, { color: statusColor }]}>
          {item.status.replace('_', ' ')}
        </Text>
      </View>
    </View>
  );
}

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.getDashboardSummary();
      setSummary(data);
    } catch (err) {
      setError('Failed to load dashboard. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.userName}>{user?.name ?? 'Policy Holder'}</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.notificationIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {summary && (
          <>
            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <MetricCard
                title="Active Policies"
                value={summary.activePolicies}
                color={COLORS.primary}
                onPress={() => navigation.navigate('Policies')}
              />
              <MetricCard
                title="Pending Claims"
                value={summary.pendingClaims}
                color={summary.pendingClaims > 0 ? COLORS.warning : COLORS.success}
                onPress={() => navigation.navigate('Claims')}
              />
              <MetricCard
                title="Total Premium Paid"
                value={`${summary.currency} ${summary.totalPremiumPaid.toLocaleString()}`}
                color={COLORS.secondary}
                onPress={() => navigation.navigate('Payments')}
              />
              {summary.nextPaymentDue && (
                <MetricCard
                  title="Next Payment"
                  value={`${summary.currency} ${summary.nextPaymentAmount?.toLocaleString()}`}
                  subtitle={`Due: ${format(new Date(summary.nextPaymentDue), 'MMM d, yyyy')}`}
                  color={COLORS.warning}
                  onPress={() => navigation.navigate('Payments')}
                />
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => navigation.navigate('SubmitClaim')}
                >
                  <Text style={styles.quickActionIcon}>📋</Text>
                  <Text style={styles.quickActionLabel}>File Claim</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => navigation.navigate('MakePayment')}
                >
                  <Text style={styles.quickActionIcon}>💳</Text>
                  <Text style={styles.quickActionLabel}>Pay Premium</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => navigation.navigate('Policies')}
                >
                  <Text style={styles.quickActionIcon}>📄</Text>
                  <Text style={styles.quickActionLabel}>My Policies</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => navigation.navigate('Analytics')}
                >
                  <Text style={styles.quickActionIcon}>📊</Text>
                  <Text style={styles.quickActionLabel}>Analytics</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recent Activity */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Activity')}>
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>
              {summary.recentActivity.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No recent activity</Text>
                </View>
              ) : (
                <FlatList
                  data={summary.recentActivity.slice(0, 5)}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => <ActivityRow item={item} />}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.primary,
  },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  userName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  notificationButton: { padding: 8 },
  notificationIcon: { fontSize: 24 },
  errorBanner: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  errorText: { color: COLORS.danger, fontSize: 14 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricTitle: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  metricValue: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  metricSubtitle: { fontSize: 11, color: COLORS.textSecondary },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  seeAll: { fontSize: 14, color: COLORS.primary },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickAction: { alignItems: 'center', flex: 1 },
  quickActionIcon: { fontSize: 28, marginBottom: 4 },
  quickActionLabel: { fontSize: 11, color: COLORS.text, textAlign: 'center' },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  activityDescription: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  activityTime: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  activityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  activityBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  separator: { height: 1, backgroundColor: COLORS.border },
  emptyState: { padding: 24, alignItems: 'center' },
  emptyStateText: { color: COLORS.textSecondary, fontSize: 14 },
});
