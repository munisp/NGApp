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
import { useAlerts } from "../hooks/useApi";
import Icon from "../components/Icon";

interface PriceAlert {
  id: string;
  symbol: string;
  condition: string;
  targetPrice: number;
  active: boolean;
}

export default function AlertsScreen() {
  const { data, loading, refetch } = useAlerts();
  const alerts: PriceAlert[] = ((data as Record<string, unknown>)?.alerts ?? []) as PriceAlert[];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const active = alerts.filter((a) => a.active).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Price Alerts</Text>
          <Text style={styles.subtitle}>{active} active of {alerts.length} total</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
          <Icon name="refresh" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Active</Text>
          <Text style={[styles.summaryValue, { color: colors.up }]}>{active}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Inactive</Text>
          <Text style={styles.summaryValue}>{alerts.length - active}</Text>
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
          const isAbove = item.condition === "ABOVE";
          const condColor = isAbove ? colors.up : colors.down;
          return (
            <View style={[styles.card, !item.active && styles.cardInactive]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBg, { backgroundColor: condColor + "20" }]}>
                  <Icon name={isAbove ? "trending-up" : "trending-down"} size={16} color={condColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <Text style={styles.condition}>
                    {isAbove ? "Above" : "Below"} ${item.targetPrice.toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.activeBadge, { backgroundColor: item.active ? colors.up + "20" : colors.bg.tertiary }]}>
                  <View style={[styles.activeDot, { backgroundColor: item.active ? colors.up : colors.text.muted }]} />
                  <Text style={[styles.activeText, { color: item.active ? colors.up : colors.text.muted }]}>
                    {item.active ? "Active" : "Inactive"}
                  </Text>
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
  cardInactive: { opacity: 0.6 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 42, height: 42, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  symbol: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  condition: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeText: { fontSize: fontSize.xs, fontWeight: "700" },
});
