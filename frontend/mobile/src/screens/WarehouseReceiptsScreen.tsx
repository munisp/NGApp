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
import { useWarehouseReceipts } from "../hooks/useApi";
import Icon from "../components/Icon";

const STATUS_COLORS: Record<string, string> = {
  active: colors.up,
  expired: colors.down,
  collateralized: colors.info,
  redeemed: colors.text.muted,
};

const GRADE_LABELS: Record<string, string> = {
  premium: "Premium",
  grade_a: "Grade A",
  grade_b: "Grade B",
  grade_c: "Grade C",
};

function formatNaira(value: number): string {
  return "\u20A6" + value.toLocaleString("en-NG");
}

interface Receipt {
  id: string;
  depositor_name: string;
  warehouse_name: string;
  warehouse_location: string;
  commodity: string;
  commodity_category: string;
  quantity_tonnes: number;
  quality_grade: string;
  total_value: number;
  currency: string;
  status: string;
  tradeable: boolean;
  collateralized: boolean;
  deposit_date: string;
  expiry_date: string;
}

export default function WarehouseReceiptsScreen() {
  const { data, loading, refetch } = useWarehouseReceipts();
  const receipts: Receipt[] = ((data as Record<string, unknown>)?.receipts ?? data ?? []) as Receipt[];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const totalValue = receipts.reduce((s, r) => s + (r.total_value || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Warehouse Receipts</Text>
          <Text style={styles.subtitle}>{receipts.length} receipts issued</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
          <Icon name="refresh" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Value</Text>
          <Text style={styles.summaryValue}>{formatNaira(totalValue)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Active</Text>
          <Text style={styles.summaryValue}>{receipts.filter((r) => r.status === "active").length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Tradeable</Text>
          <Text style={styles.summaryValue}>{receipts.filter((r) => r.tradeable).length}</Text>
        </View>
      </View>

      <FlatList
        data={receipts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const statusColor = STATUS_COLORS[item.status] || colors.text.muted;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconBg}>
                  <Icon name="package" size={18} color={colors.brand.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.receiptId}>{item.id}</Text>
                  <Text style={styles.commodity}>{item.commodity} — {GRADE_LABELS[item.quality_grade] || item.quality_grade}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                </View>
              </View>

              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Depositor</Text>
                  <Text style={styles.detailValue}>{item.depositor_name}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Quantity</Text>
                  <Text style={styles.detailValue}>{item.quantity_tonnes} tonnes</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Warehouse</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{item.warehouse_name}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Value</Text>
                  <Text style={styles.detailValue}>{formatNaira(item.total_value)}</Text>
                </View>
              </View>

              <View style={styles.dateRow}>
                <View style={styles.dateItem}>
                  <Icon name="calendar" size={12} color={colors.text.muted} />
                  <Text style={styles.dateText}>Deposited: {item.deposit_date}</Text>
                </View>
                <View style={styles.dateItem}>
                  <Icon name="clock" size={12} color={colors.text.muted} />
                  <Text style={styles.dateText}>Expires: {item.expiry_date}</Text>
                </View>
              </View>

              <View style={styles.badges}>
                {item.tradeable && (
                  <View style={[styles.badge, { backgroundColor: colors.brand.subtle }]}>
                    <Text style={[styles.badgeText, { color: colors.brand.primary }]}>Tradeable</Text>
                  </View>
                )}
                {item.collateralized && (
                  <View style={[styles.badge, { backgroundColor: colors.info + "20" }]}>
                    <Text style={[styles.badgeText, { color: colors.info }]}>Collateralized</Text>
                  </View>
                )}
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
  iconBg: { width: 42, height: 42, borderRadius: borderRadius.md, backgroundColor: colors.brand.subtle, alignItems: "center", justifyContent: "center" },
  receiptId: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  commodity: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  statusText: { fontSize: fontSize.xs, fontWeight: "700", textTransform: "capitalize" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.lg, gap: spacing.sm },
  detailItem: { width: "47%", marginBottom: spacing.xs },
  detailLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  detailValue: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.primary, marginTop: 2 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  dateItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dateText: { fontSize: fontSize.xs, color: colors.text.muted },
  badges: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  badgeText: { fontSize: fontSize.xs, fontWeight: "700" },
});
