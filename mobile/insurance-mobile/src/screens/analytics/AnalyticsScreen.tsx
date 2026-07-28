/**
 * Analytics Screen — Insurance Platform Mobile
 * Shows personal insurance analytics and spending insights
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../services/api';

const COLORS = { primary: '#1E40AF', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', background: '#F8FAFC', card: '#FFFFFF', text: '#1E293B', textSecondary: '#64748B', border: '#E2E8F0' };

function MetricCard({ title, value, subtitle, color }: { title: string; value: string; subtitle?: string; color?: string }) {
  return (
    <View style={[styles.metricCard, { borderTopColor: color ?? COLORS.primary }]}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={[styles.metricValue, { color: color ?? COLORS.text }]}>{value}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export default function AnalyticsScreen() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'1M' | '3M' | '6M' | '1Y'>('3M');

  const loadAnalytics = useCallback(async () => {
    try {
      const months = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }[period] ?? 3;
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString();
      const data = await apiClient.getInsuranceAnalytics({ startDate, endDate });
      setAnalytics(data);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const PERIODS: Array<'1M' | '3M' | '6M' | '1Y'> = ['1M', '3M', '6M', '1Y'];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnalytics(); }} colors={[COLORS.primary]} />}
      >
        <Text style={styles.title}>My Analytics</Text>
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodBtnActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : analytics ? (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard title="Total Premiums" value={`₦${Number(analytics.totalPremiums ?? 0).toLocaleString()}`} subtitle="Paid this period" color={COLORS.primary} />
              <MetricCard title="Total Claims" value={`₦${Number(analytics.totalClaimsAmount ?? 0).toLocaleString()}`} subtitle={`${analytics.claimsCount ?? 0} claims`} color={COLORS.warning} />
              <MetricCard title="Claims Ratio" value={`${analytics.claimsRatio ?? 0}%`} subtitle="Claims vs premiums" color={analytics.claimsRatio > 80 ? COLORS.danger : COLORS.success} />
              <MetricCard title="Active Policies" value={String(analytics.activePolicies ?? 0)} subtitle="Currently active" color={COLORS.success} />
            </View>

            {analytics.monthlyBreakdown && analytics.monthlyBreakdown.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
                {analytics.monthlyBreakdown.map((m: any, i: number) => (
                  <View key={i} style={styles.breakdownRow}>
                    <Text style={styles.breakdownMonth}>{m.month}</Text>
                    <View style={styles.breakdownBars}>
                      <View style={[styles.bar, { width: `${Math.min(100, (m.premiums / (analytics.totalPremiums || 1)) * 100)}%`, backgroundColor: COLORS.primary }]} />
                    </View>
                    <Text style={styles.breakdownAmount}>₦{Number(m.premiums ?? 0).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}

            {analytics.policyTypeBreakdown && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Coverage by Type</Text>
                <View style={styles.card}>
                  {Object.entries(analytics.policyTypeBreakdown).map(([type, count]: [string, any], i) => (
                    <View key={i} style={styles.typeRow}>
                      <Text style={styles.typeLabel}>{type}</Text>
                      <Text style={styles.typeValue}>{count} policies</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No analytics data</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  periodBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  periodBtnTextActive: { color: '#FFFFFF' },
  centered: { paddingTop: 60, alignItems: 'center' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  metricCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, borderTopWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  metricTitle: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  metricValue: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  metricSubtitle: { fontSize: 11, color: COLORS.textSecondary },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, gap: 10 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  breakdownMonth: { fontSize: 12, color: COLORS.textSecondary, width: 40 },
  breakdownBars: { flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  breakdownAmount: { fontSize: 12, color: COLORS.text, fontWeight: '500', width: 80, textAlign: 'right' },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  typeLabel: { fontSize: 14, color: COLORS.text },
  typeValue: { fontSize: 14, fontWeight: '500', color: COLORS.primary },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
});
