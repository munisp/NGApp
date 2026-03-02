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
import { useFeeStatus } from "../hooks/useApi";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

const STREAM_ICONS: Record<string, IconName> = {
  trading_commissions: "activity",
  clearing_fees: "layers",
  market_data_fees: "bar-chart",
  listing_fees: "star",
  membership_fees: "briefcase",
  technology_fees: "zap",
  settlement_fees: "check",
  regulatory_fees: "shield",
  api_access_fees: "key",
  tokenization_fees: "gem",
};

const STREAM_COLORS: Record<string, string> = {
  trading_commissions: colors.brand.primary,
  clearing_fees: colors.info,
  market_data_fees: colors.purple,
  listing_fees: colors.warning,
  membership_fees: "#EAB308",
  technology_fees: "#F97316",
  settlement_fees: colors.up,
  regulatory_fees: "#DC2626",
  api_access_fees: "#0891B2",
  tokenization_fees: "#8B5CF6",
};

function formatNaira(value: number): string {
  if (value >= 1000000) return "\u20A6" + (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return "\u20A6" + (value / 1000).toFixed(0) + "K";
  return "\u20A6" + value.toLocaleString("en-NG");
}

interface FeeStream {
  stream: string;
  label: string;
  daily_revenue: number;
  monthly_revenue: number;
  transactions: number;
  avg_fee_bps: number;
}

export default function RevenueScreen() {
  const { data, loading, refetch } = useFeeStatus();
  const feeData = (data ?? {}) as Record<string, unknown>;
  const streams: FeeStream[] = (feeData.revenue_streams ?? []) as FeeStream[];
  const totalDaily = streams.reduce((s, r) => s + (r.daily_revenue || 0), 0);
  const totalMonthly = streams.reduce((s, r) => s + (r.monthly_revenue || 0), 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Revenue</Text>
            <Text style={styles.subtitle}>{streams.length} revenue streams active</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
            <Icon name="refresh" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.brand.primary + "15" }]}>
            <Text style={styles.summaryLabel}>Daily Revenue</Text>
            <Text style={[styles.summaryValue, { color: colors.brand.primary }]}>{formatNaira(totalDaily)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Monthly Revenue</Text>
            <Text style={styles.summaryValue}>{formatNaira(totalMonthly)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue Streams</Text>
          {streams.map((stream) => {
            const iconName = STREAM_ICONS[stream.stream] || "dollar";
            const color = STREAM_COLORS[stream.stream] || colors.text.muted;
            const pct = totalMonthly > 0 ? ((stream.monthly_revenue / totalMonthly) * 100).toFixed(1) : "0";
            return (
              <View key={stream.stream} style={styles.streamCard}>
                <View style={styles.streamHeader}>
                  <View style={[styles.iconBg, { backgroundColor: color + "20" }]}>
                    <Icon name={iconName} size={16} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.streamName}>{stream.label}</Text>
                    <Text style={styles.streamPct}>{pct}% of total</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.streamRevenue}>{formatNaira(stream.monthly_revenue)}</Text>
                    <Text style={styles.streamDaily}>{formatNaira(stream.daily_revenue)}/day</Text>
                  </View>
                </View>

                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>

                <View style={styles.streamMeta}>
                  <Text style={styles.metaText}>{stream.transactions.toLocaleString()} txns</Text>
                  <Text style={styles.metaText}>{stream.avg_fee_bps} bps avg</Text>
                </View>
              </View>
            );
          })}
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
  summaryRow: { flexDirection: "row", paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.sm },
  summaryCard: { flex: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  summaryValue: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary, marginTop: 4 },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, marginBottom: spacing.md },
  streamCard: { backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  streamHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 38, height: 38, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  streamName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  streamPct: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  streamRevenue: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  streamDaily: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: colors.bg.tertiary, marginTop: spacing.md, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  streamMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  metaText: { fontSize: fontSize.xs, color: colors.text.muted },
});
