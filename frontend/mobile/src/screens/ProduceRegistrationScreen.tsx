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
import { useProduceInventory } from "../hooks/useApi";
import Icon from "../components/Icon";

const STATUS_COLORS: Record<string, string> = {
  harvested: colors.up,
  growing: colors.warning,
  registered: colors.info,
  listed: colors.brand.primary,
};

function formatNaira(value: number): string {
  return "\u20A6" + value.toLocaleString("en-NG");
}

interface ProduceItem {
  id: string;
  producer_name: string;
  commodity: string;
  commodity_category: string;
  variety: string;
  estimated_quantity_tonnes: number;
  quality_grade: string;
  farm_location: string;
  farm_size_hectares: number;
  planting_date: string;
  expected_harvest_date: string;
  asking_price_per_tonne: number;
  status: string;
  listed_on_exchange: boolean;
  warehouse_receipt_id?: string;
}

export default function ProduceRegistrationScreen() {
  const { data, loading, refetch } = useProduceInventory();
  const inventory: ProduceItem[] = ((data as Record<string, unknown>)?.inventory ?? data ?? []) as ProduceItem[];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Produce & Crops</Text>
          <Text style={styles.subtitle}>{inventory.length} registered items</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
          <Icon name="refresh" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Items</Text>
          <Text style={styles.summaryValue}>{inventory.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Harvested</Text>
          <Text style={styles.summaryValue}>{inventory.filter((i) => i.status === "harvested").length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Listed</Text>
          <Text style={styles.summaryValue}>{inventory.filter((i) => i.listed_on_exchange).length}</Text>
        </View>
      </View>

      <FlatList
        data={inventory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const statusColor = STATUS_COLORS[item.status] || colors.text.muted;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconBg}>
                  <Icon name="wheat" size={18} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.commodity} — {item.variety}</Text>
                  <Text style={styles.producerName}>{item.producer_name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                </View>
              </View>

              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Quantity</Text>
                  <Text style={styles.detailValue}>{item.estimated_quantity_tonnes} tonnes</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Grade</Text>
                  <Text style={styles.detailValue}>{item.quality_grade.replace("_", " ")}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Farm Size</Text>
                  <Text style={styles.detailValue}>{item.farm_size_hectares} ha</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Price/Tonne</Text>
                  <Text style={styles.detailValue}>{formatNaira(item.asking_price_per_tonne)}</Text>
                </View>
              </View>

              <View style={styles.locationRow}>
                <Icon name="globe" size={12} color={colors.text.muted} />
                <Text style={styles.locationText} numberOfLines={1}>{item.farm_location}</Text>
              </View>

              <View style={styles.dateRow}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Planted</Text>
                  <Text style={styles.dateValue}>{item.planting_date}</Text>
                </View>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Harvest</Text>
                  <Text style={styles.dateValue}>{item.expected_harvest_date}</Text>
                </View>
              </View>

              {item.listed_on_exchange && (
                <View style={[styles.listedBadge]}>
                  <Icon name="check" size={12} color={colors.brand.primary} />
                  <Text style={styles.listedText}>Listed on Exchange</Text>
                </View>
              )}
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
  iconBg: { width: 42, height: 42, borderRadius: borderRadius.md, backgroundColor: "rgba(245, 158, 11, 0.12)", alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  producerName: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  statusText: { fontSize: fontSize.xs, fontWeight: "700", textTransform: "capitalize" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.lg, gap: spacing.sm },
  detailItem: { width: "47%", marginBottom: spacing.xs },
  detailLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  detailValue: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.primary, marginTop: 2, textTransform: "capitalize" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  locationText: { fontSize: fontSize.xs, color: colors.text.muted, flex: 1 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  dateItem: { alignItems: "center" },
  dateLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  dateValue: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.primary, marginTop: 2 },
  listedBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  listedText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.brand.primary },
});
