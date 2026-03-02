import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";
import { useAnalyticsDashboard, useAiInsights } from "../hooks/useApi";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

function formatNumber(value: number): string {
  if (value >= 1000000000) return "$" + (value / 1000000000).toFixed(2) + "B";
  if (value >= 1000000) return "$" + (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return "$" + (value / 1000).toFixed(0) + "K";
  return "$" + value.toLocaleString();
}

const METRIC_ICONS: Record<string, IconName> = {
  marketCap: "globe",
  volume24h: "activity",
  activePairs: "layers",
  activeTraders: "user",
};

const METRIC_LABELS: Record<string, string> = {
  marketCap: "Market Cap",
  volume24h: "24h Volume",
  activePairs: "Active Pairs",
  activeTraders: "Active Traders",
};

export default function AnalyticsScreen() {
  const { data: dashData, loading: dashLoading, refetch } = useAnalyticsDashboard();
  const { data: aiData, loading: aiLoading } = useAiInsights();

  const dash = (dashData ?? {}) as Record<string, number>;
  const ai = (aiData ?? {}) as Record<string, unknown>;
  const sentiment = (ai.sentiment ?? {}) as Record<string, number>;
  const loading = dashLoading || aiLoading;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const metrics = [
    { key: "marketCap", value: dash.marketCap || 0 },
    { key: "volume24h", value: dash.volume24h || 0 },
    { key: "activePairs", value: dash.activePairs || 0 },
    { key: "activeTraders", value: dash.activeTraders || 0 },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Analytics</Text>
            <Text style={styles.subtitle}>Market overview & AI insights</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
            <Icon name="refresh" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          {metrics.map((m) => {
            const iconName = METRIC_ICONS[m.key] || "bar-chart";
            const label = METRIC_LABELS[m.key] || m.key;
            const isNumber = m.key === "activePairs" || m.key === "activeTraders";
            return (
              <View key={m.key} style={styles.metricCard}>
                <View style={styles.metricIconRow}>
                  <Icon name={iconName} size={16} color={colors.brand.primary} />
                </View>
                <Text style={styles.metricLabel}>{label}</Text>
                <Text style={styles.metricValue}>
                  {isNumber ? m.value.toLocaleString() : formatNumber(m.value)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* AI Sentiment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Market Sentiment</Text>
          <View style={styles.sentimentCard}>
            <View style={styles.sentimentRow}>
              <View style={styles.sentimentItem}>
                <View style={[styles.sentimentDot, { backgroundColor: colors.up }]} />
                <Text style={styles.sentimentLabel}>Bullish</Text>
                <Text style={[styles.sentimentValue, { color: colors.up }]}>{sentiment.bullish || 0}%</Text>
              </View>
              <View style={styles.sentimentItem}>
                <View style={[styles.sentimentDot, { backgroundColor: colors.down }]} />
                <Text style={styles.sentimentLabel}>Bearish</Text>
                <Text style={[styles.sentimentValue, { color: colors.down }]}>{sentiment.bearish || 0}%</Text>
              </View>
              <View style={styles.sentimentItem}>
                <View style={[styles.sentimentDot, { backgroundColor: colors.text.muted }]} />
                <Text style={styles.sentimentLabel}>Neutral</Text>
                <Text style={styles.sentimentValue}>{sentiment.neutral || 0}%</Text>
              </View>
            </View>

            {/* Sentiment Bar */}
            <View style={styles.sentimentBar}>
              <View style={[styles.sentimentFill, { flex: sentiment.bullish || 1, backgroundColor: colors.up }]} />
              <View style={[styles.sentimentFill, { flex: sentiment.neutral || 1, backgroundColor: colors.text.muted }]} />
              <View style={[styles.sentimentFill, { flex: sentiment.bearish || 1, backgroundColor: colors.down }]} />
            </View>
          </View>
        </View>

        {/* Platform Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Health</Text>
          <View style={styles.healthRow}>
            <View style={styles.healthCard}>
              <View style={[styles.healthDot, { backgroundColor: colors.up }]} />
              <Text style={styles.healthLabel}>Exchange</Text>
              <Text style={[styles.healthStatus, { color: colors.up }]}>Online</Text>
            </View>
            <View style={styles.healthCard}>
              <View style={[styles.healthDot, { backgroundColor: colors.up }]} />
              <Text style={styles.healthLabel}>Matching</Text>
              <Text style={[styles.healthStatus, { color: colors.up }]}>Active</Text>
            </View>
            <View style={styles.healthCard}>
              <View style={[styles.healthDot, { backgroundColor: colors.up }]} />
              <Text style={styles.healthLabel}>Settlement</Text>
              <Text style={[styles.healthStatus, { color: colors.up }]}>Running</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.sm },
  metricCard: { width: "47%", backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  metricIconRow: { marginBottom: spacing.sm },
  metricLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  metricValue: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary, marginTop: 4 },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, marginBottom: spacing.md },
  sentimentCard: { backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sentimentRow: { flexDirection: "row", justifyContent: "space-around" },
  sentimentItem: { alignItems: "center", gap: spacing.xs },
  sentimentDot: { width: 10, height: 10, borderRadius: 5 },
  sentimentLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  sentimentValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  sentimentBar: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", marginTop: spacing.lg, gap: 2 },
  sentimentFill: { borderRadius: 3 },
  healthRow: { flexDirection: "row", gap: spacing.sm },
  healthCard: { flex: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: spacing.xs },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  healthStatus: { fontSize: fontSize.sm, fontWeight: "700" },
});
