import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";
import { useSurveillanceAlerts } from "../hooks/useApi";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

const SEVERITY_COLORS: Record<string, string> = {
  critical: colors.down,
  high: "#F97316",
  medium: colors.warning,
  low: colors.info,
};

const TYPE_ICONS: Record<string, IconName> = {
  spoofing: "alert-triangle",
  wash_trading: "alert-circle",
  insider_trading: "eye",
  market_manipulation: "shield",
  unusual_volume: "bar-chart",
  price_anomaly: "activity",
};

interface SurveillanceAlert {
  id: string;
  alert_type: string;
  severity: string;
  symbol: string;
  description: string;
  timestamp: string;
  status: string;
  account_id?: string;
}

export default function SurveillanceScreen() {
  const { data, loading, refetch } = useSurveillanceAlerts();
  const alerts: SurveillanceAlert[] = ((data as Record<string, unknown>)?.alerts ?? data ?? []) as SurveillanceAlert[];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const critical = alerts.filter((a) => a.severity === "critical").length;
  const high = alerts.filter((a) => a.severity === "high").length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Surveillance</Text>
          <Text style={styles.subtitle}>{alerts.length} alerts detected</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
          <Icon name="refresh" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, critical > 0 && { borderColor: colors.down + "40" }]}>
          <Text style={styles.summaryLabel}>Critical</Text>
          <Text style={[styles.summaryValue, { color: colors.down }]}>{critical}</Text>
        </View>
        <View style={[styles.summaryCard, high > 0 && { borderColor: "#F97316" + "40" }]}>
          <Text style={styles.summaryLabel}>High</Text>
          <Text style={[styles.summaryValue, { color: "#F97316" }]}>{high}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>{alerts.length}</Text>
        </View>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const sevColor = SEVERITY_COLORS[item.severity] || colors.text.muted;
          const typeIcon = TYPE_ICONS[item.alert_type] || "alert-triangle";
          return (
            <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: sevColor }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBg, { backgroundColor: sevColor + "20" }]}>
                  <Icon name={typeIcon} size={16} color={sevColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertType}>{item.alert_type.replace(/_/g, " ")}</Text>
                  <Text style={styles.alertSymbol}>{item.symbol}</Text>
                </View>
                <View style={[styles.sevBadge, { backgroundColor: sevColor + "20" }]}>
                  <Text style={[styles.sevText, { color: sevColor }]}>{item.severity}</Text>
                </View>
              </View>

              <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Icon name="clock" size={12} color={colors.text.muted} />
                  <Text style={styles.metaText}>{new Date(item.timestamp).toLocaleString()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.status === "open" ? colors.warning + "20" : colors.up + "20" }]}>
                  <Text style={[styles.statusText, { color: item.status === "open" ? colors.warning : colors.up }]}>{item.status}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />
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
  summaryCard: { flex: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  summaryValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, marginTop: 4 },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 38, height: 38, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  alertType: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary, textTransform: "capitalize" },
  alertSymbol: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  sevBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  sevText: { fontSize: fontSize.xs, fontWeight: "700", textTransform: "capitalize" },
  description: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: spacing.md, lineHeight: 20 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontSize: fontSize.xs, color: colors.text.muted },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  statusText: { fontSize: fontSize.xs, fontWeight: "700", textTransform: "capitalize" },
});
