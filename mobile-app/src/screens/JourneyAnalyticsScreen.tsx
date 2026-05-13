import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface JourneyMetric {
  journeyId: number;
  journeyName: string;
  totalRuns: number;
  successRate: number;
  avgDuration: string;
  lastRun: string;
  trend: 'up' | 'down' | 'stable';
}

interface DailyMetric {
  date: string;
  runs: number;
  success: number;
  failed: number;
}

const mockMetrics: JourneyMetric[] = [
  { journeyId: 1, journeyName: 'Admin Provision Organization', totalRuns: 1250, successRate: 98.5, avgDuration: '2.3s', lastRun: '5 min ago', trend: 'up' },
  { journeyId: 2, journeyName: 'Participant KYB Activation', totalRuns: 890, successRate: 94.2, avgDuration: '45s', lastRun: '12 min ago', trend: 'stable' },
  { journeyId: 3, journeyName: 'User KYC Product Access', totalRuns: 3420, successRate: 96.8, avgDuration: '30s', lastRun: '2 min ago', trend: 'up' },
  { journeyId: 4, journeyName: 'Merchant POS Onboarding', totalRuns: 567, successRate: 92.1, avgDuration: '1m 15s', lastRun: '25 min ago', trend: 'down' },
  { journeyId: 5, journeyName: 'Developer Sandbox Access', totalRuns: 2100, successRate: 99.1, avgDuration: '5s', lastRun: '1 min ago', trend: 'up' },
  { journeyId: 6, journeyName: 'P2P Transfer Mojaloop', totalRuns: 45000, successRate: 99.7, avgDuration: '1.2s', lastRun: '10 sec ago', trend: 'up' },
  { journeyId: 7, journeyName: 'QR Code Payment', totalRuns: 28000, successRate: 98.9, avgDuration: '0.8s', lastRun: '5 sec ago', trend: 'stable' },
  { journeyId: 8, journeyName: 'Remittance FX Transfer', totalRuns: 5600, successRate: 97.3, avgDuration: '3.5s', lastRun: '3 min ago', trend: 'up' },
];

const mockDailyData: DailyMetric[] = [
  { date: 'Mon', runs: 12500, success: 12300, failed: 200 },
  { date: 'Tue', runs: 13200, success: 13000, failed: 200 },
  { date: 'Wed', runs: 11800, success: 11600, failed: 200 },
  { date: 'Thu', runs: 14500, success: 14200, failed: 300 },
  { date: 'Fri', runs: 15200, success: 15000, failed: 200 },
  { date: 'Sat', runs: 8900, success: 8800, failed: 100 },
  { date: 'Sun', runs: 7600, success: 7500, failed: 100 },
];

export default function JourneyAnalyticsScreen() {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  const totalRuns = mockMetrics.reduce((sum, m) => sum + m.totalRuns, 0);
  const avgSuccessRate = mockMetrics.reduce((sum, m) => sum + m.successRate, 0) / mockMetrics.length;
  const maxRuns = Math.max(...mockDailyData.map(d => d.runs));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Journey Analytics</Text>
          <Text style={styles.subtitle}>Monitor performance across all user journeys</Text>
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          {(['24h', '7d', '30d'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                timeRange === range && styles.timeRangeButtonActive,
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  timeRange === range && styles.timeRangeTextActive,
                ]}
              >
                {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Runs</Text>
            <Text style={styles.summaryValue}>{totalRuns.toLocaleString()}</Text>
            <Text style={styles.summaryTrend}>+12.5% from last period</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Avg Success Rate</Text>
            <Text style={styles.summaryValue}>{avgSuccessRate.toFixed(1)}%</Text>
            <Text style={styles.summaryTrend}>+0.3% from last period</Text>
          </View>
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Active Journeys</Text>
            <Text style={styles.summaryValue}>20</Text>
            <Text style={styles.summaryNeutral}>All operational</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Avg Duration</Text>
            <Text style={styles.summaryValue}>1.8s</Text>
            <Text style={styles.summaryTrend}>-0.2s from last period</Text>
          </View>
        </View>

        {/* Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Journey Runs Over Time</Text>
          <View style={styles.chart}>
            {mockDailyData.map((day, index) => {
              const successHeight = (day.success / maxRuns) * 150;
              const failedHeight = (day.failed / maxRuns) * 150;
              
              return (
                <View key={day.date} style={styles.chartBar}>
                  <View style={styles.barContainer}>
                    <View style={[styles.barFailed, { height: failedHeight }]} />
                    <View style={[styles.barSuccess, { height: successHeight }]} />
                  </View>
                  <Text style={styles.chartLabel}>{day.date}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.legendText}>Success</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Failed</Text>
            </View>
          </View>
        </View>

        {/* Journey Performance List */}
        <View style={styles.performanceContainer}>
          <Text style={styles.performanceTitle}>Journey Performance</Text>
          {mockMetrics.map((metric) => (
            <View key={metric.journeyId} style={styles.performanceCard}>
              <View style={styles.performanceHeader}>
                <View style={styles.performanceInfo}>
                  <Text style={styles.performanceName} numberOfLines={1}>
                    {metric.journeyName}
                  </Text>
                  <Text style={styles.performanceId}>Journey {metric.journeyId}</Text>
                </View>
                <View style={[
                  styles.trendBadge,
                  metric.trend === 'up' && styles.trendUp,
                  metric.trend === 'down' && styles.trendDown,
                  metric.trend === 'stable' && styles.trendStable,
                ]}>
                  <Text style={[
                    styles.trendText,
                    metric.trend === 'up' && styles.trendTextUp,
                    metric.trend === 'down' && styles.trendTextDown,
                    metric.trend === 'stable' && styles.trendTextStable,
                  ]}>
                    {metric.trend === 'up' ? 'Up' : metric.trend === 'down' ? 'Down' : 'Stable'}
                  </Text>
                </View>
              </View>
              <View style={styles.performanceStats}>
                <View style={styles.performanceStat}>
                  <Text style={styles.statLabel}>Runs</Text>
                  <Text style={styles.statValue}>{metric.totalRuns.toLocaleString()}</Text>
                </View>
                <View style={styles.performanceStat}>
                  <Text style={styles.statLabel}>Success</Text>
                  <Text style={styles.statValue}>{metric.successRate}%</Text>
                </View>
                <View style={styles.performanceStat}>
                  <Text style={styles.statLabel}>Avg Time</Text>
                  <Text style={styles.statValue}>{metric.avgDuration}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timeRangeButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  timeRangeTextActive: {
    color: '#FFFFFF',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  summaryTrend: {
    fontSize: 12,
    color: '#059669',
  },
  summaryNeutral: {
    fontSize: 12,
    color: '#6B7280',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 180,
    paddingBottom: 24,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    width: 24,
    height: 150,
    justifyContent: 'flex-end',
  },
  barSuccess: {
    backgroundColor: '#22C55E',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barFailed: {
    backgroundColor: '#EF4444',
  },
  chartLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  performanceContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  performanceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  performanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  performanceInfo: {
    flex: 1,
    marginRight: 8,
  },
  performanceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  performanceId: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendUp: {
    backgroundColor: '#DCFCE7',
  },
  trendDown: {
    backgroundColor: '#FEE2E2',
  },
  trendStable: {
    backgroundColor: '#F3F4F6',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  trendTextUp: {
    color: '#059669',
  },
  trendTextDown: {
    color: '#DC2626',
  },
  trendTextStable: {
    color: '#6B7280',
  },
  performanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceStat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
});
