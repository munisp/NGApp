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
import { useFractionalAssets } from "../hooks/useApi";
import Icon from "../components/Icon";

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#627EEA",
  polygon: "#8247E5",
  hyperledger: "#2F3134",
};

const COMMODITY_ICONS: Record<string, string> = {
  GOLD: "Au",
  COFFEE: "Cf",
  MAIZE: "Mz",
  CRUDE_OIL: "Oil",
  CARBON: "CO2",
};

function formatUSD(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

interface FractionalAsset {
  asset_id: string;
  token_id: string;
  symbol: string;
  name: string;
  total_fractions: number;
  available_fractions: number;
  fraction_price: number;
  total_value: number;
  holders: number;
  chain: string;
  contract_address: string;
  metadata_cid: string;
  status: string;
}

export default function DigitalAssetsScreen() {
  const { data, loading, refetch } = useFractionalAssets();
  const assets: FractionalAsset[] = (data as Record<string, unknown>)?.assets as FractionalAsset[] ?? [];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const totalValue = assets.reduce((sum, a) => sum + a.total_value, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Digital Assets</Text>
          <Text style={styles.subtitle}>
            {assets.length} tokenized commodities | ERC-1155
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
          <Icon name="refresh-cw" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Value</Text>
          <Text style={styles.summaryValue}>{formatUSD(totalValue)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Assets</Text>
          <Text style={styles.summaryValue}>{assets.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Chains</Text>
          <Text style={styles.summaryValue}>3</Text>
        </View>
      </View>

      {/* Asset List */}
      <FlatList
        data={assets}
        keyExtractor={(item) => item.asset_id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const chainColor = CHAIN_COLORS[item.chain] || "#6B7280";
          const icon = COMMODITY_ICONS[item.symbol] || item.symbol.slice(0, 2);
          const pctAvailable = ((item.available_fractions / item.total_fractions) * 100).toFixed(1);

          return (
            <View style={styles.card}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={[styles.iconBg, { backgroundColor: chainColor + "30" }]}>
                  <Text style={[styles.iconText, { color: chainColor }]}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assetSymbol}>{item.symbol}</Text>
                  <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
                </View>
                <View style={[styles.chainBadge, { backgroundColor: chainColor + "20" }]}>
                  <Text style={[styles.chainText, { color: chainColor }]}>{item.chain}</Text>
                </View>
              </View>

              {/* Price Row */}
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.priceLabel}>Price / Fraction</Text>
                  <Text style={styles.priceValue}>{formatUSD(item.fraction_price)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.priceLabel}>Total Value</Text>
                  <Text style={styles.priceValue}>{formatUSD(item.total_value)}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressText}>{formatNumber(item.available_fractions)} available</Text>
                  <Text style={styles.progressText}>{pctAvailable}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pctAvailable}%` as string, backgroundColor: chainColor }]} />
                </View>
                <Text style={styles.fractionsTotal}>
                  {formatNumber(item.total_fractions)} total fractions | {item.holders} holders
                </Text>
              </View>

              {/* IPFS CID */}
              <View style={styles.cidRow}>
                <Icon name="hard-drive" size={12} color={colors.text.muted} />
                <Text style={styles.cidText} numberOfLines={1}>{item.metadata_cid}</Text>
              </View>

              {/* Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.tradeBtn, { backgroundColor: chainColor + "80" }]}>
                  <Icon name="arrow-up-down" size={14} color="#FFFFFF" />
                  <Text style={styles.tradeBtnText}>Trade Fractions</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailBtn}>
                  <Icon name="external-link" size={14} color={colors.text.secondary} />
                </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  summaryValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, marginTop: 4 },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconBg: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 12, fontWeight: "800" },
  assetSymbol: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  assetName: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  chainBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  chainText: { fontSize: fontSize.xs, fontWeight: "700" },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  priceLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  priceValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, marginTop: 2 },
  progressContainer: { marginTop: spacing.md },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressText: { fontSize: fontSize.xs, color: colors.text.muted },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bg.tertiary,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },
  fractionsTotal: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: 4,
  },
  cidRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cidText: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    fontFamily: "monospace",
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tradeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  tradeBtnText: { fontSize: fontSize.sm, fontWeight: "600", color: "#FFFFFF" },
  detailBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
