import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius, shadows } from "../styles/theme";
import { usePortfolio, usePositions } from "../hooks/useApi";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

const SYMBOL_ICONS: Record<string, IconName> = {
  MAIZE: "wheat", GOLD: "gem", COFFEE: "coffee", CRUDE_OIL: "droplet",
};
const SYMBOL_COLORS: Record<string, string> = {
  MAIZE: "#F59E0B", GOLD: "#EAB308", COFFEE: "#92400E", CRUDE_OIL: "#3B82F6",
};

const FALLBACK_POSITIONS = [
  { symbol: "MAIZE", side: "LONG" as const, qty: 100, entry: 282.0, current: 285.5, pnl: 350.0, pnlPct: 1.24, margin: 2820 },
  { symbol: "GOLD", side: "SHORT" as const, qty: 4, entry: 2349.8, current: 2345.6, pnl: 16.8, pnlPct: 0.18, margin: 469.96 },
  { symbol: "COFFEE", side: "LONG" as const, qty: 20, entry: 4518.5, current: 4520.0, pnl: 30.0, pnlPct: 0.03, margin: 9037 },
  { symbol: "CRUDE_OIL", side: "LONG" as const, qty: 200, entry: 76.5, current: 78.42, pnl: 384.0, pnlPct: 2.51, margin: 1224 },
];

const SUMMARY_CARDS: { label: string; icon: IconName; color: string; bg: string }[] = [
  { label: "Total Value", icon: "wallet", color: colors.brand.primary, bg: "rgba(16, 185, 129, 0.12)" },
  { label: "Total P&L", icon: "trending-up", color: colors.up, bg: "rgba(16, 185, 129, 0.12)" },
  { label: "Margin Used", icon: "shield", color: colors.warning, bg: "rgba(245, 158, 11, 0.12)" },
  { label: "Positions", icon: "layers", color: colors.info, bg: "rgba(59, 130, 246, 0.12)" },
];

export default function PortfolioScreen() {
  const { data: portfolioData } = usePortfolio();
  const { data: positionsData } = usePositions();

  // Map API data to display format, fall back to hardcoded data
  const positions = useMemo(() => {
    const apiPositions = (positionsData as any)?.positions;
    if (apiPositions && apiPositions.length > 0) {
      return apiPositions.map((p: any) => ({
        symbol: p.symbol,
        side: p.side === "BUY" ? "LONG" as const : "SHORT" as const,
        qty: p.quantity,
        entry: p.averageEntryPrice,
        current: p.currentPrice,
        pnl: p.unrealizedPnl,
        pnlPct: p.unrealizedPnlPercent,
        margin: p.margin,
      }));
    }
    return FALLBACK_POSITIONS;
  }, [positionsData]);

  const totalValue = (portfolioData as any)?.totalValue ?? 156420;
  const totalPnl = positions.reduce((s: number, p: { pnl: number }) => s + p.pnl, 0);
  const totalMargin = positions.reduce((s: number, p: { margin: number }) => s + p.margin, 0);
  const marginPct = totalValue > 0 ? ((totalMargin / totalValue) * 100) : 13.8;
  const summaryValues = [`$${totalValue.toLocaleString()}`, `+$${totalPnl.toFixed(0)}`, `$${totalMargin.toLocaleString()}`, `${positions.length}`];

  const handleClosePosition = (symbol: string) => {
    Alert.alert(
      "Close Position",
      `Are you sure you want to close your ${symbol} position?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close",
          style: "destructive",
          onPress: () => Alert.alert("Success", `${symbol} position closed`),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="pie-chart" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          {SUMMARY_CARDS.map((card, i) => (
            <View key={card.label} style={styles.summaryCard}>
              <View style={[styles.summaryIconBg, { backgroundColor: card.bg }]}>
                <Icon name={card.icon} size={16} color={card.color} />
              </View>
              <Text style={styles.summaryLabel}>{card.label}</Text>
              <Text style={[styles.summaryValue, i === 1 && { color: colors.up }]}>
                {summaryValues[i]}
              </Text>
            </View>
          ))}
        </View>

        {/* Margin Bar */}
        <View style={styles.marginBar}>
          <View style={styles.marginBarHeader}>
            <View style={styles.marginLabelRow}>
              <Icon name="bar-chart" size={14} color={colors.text.muted} />
              <Text style={styles.marginBarLabel}>Margin Utilization</Text>
            </View>
            <Text style={styles.marginBarPct}>{marginPct.toFixed(1)}%</Text>
          </View>
          <View style={styles.marginBarTrack}>
            <View style={[styles.marginBarFill, { width: `${Math.min(marginPct, 100)}%` }]} />
          </View>
          <View style={styles.marginLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.brand.primary }]} />
              <Text style={styles.legendText}>Used</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.bg.tertiary }]} />
              <Text style={styles.legendText}>Available</Text>
            </View>
          </View>
        </View>

        {/* Positions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Open Positions</Text>
            <Text style={styles.sectionCount}>{positions.length}</Text>
          </View>
          {positions.map((pos) => {
            const iconName = SYMBOL_ICONS[pos.symbol] || "circle-dot";
            const iconColor = SYMBOL_COLORS[pos.symbol] || colors.text.muted;
            return (
              <View key={pos.symbol} style={styles.positionCard}>
                <View style={styles.positionHeader}>
                  <View style={styles.positionLeft}>
                    <View style={[styles.positionIconBg, { backgroundColor: iconColor + "18" }]}>
                      <Icon name={iconName} size={16} color={iconColor} />
                    </View>
                    <View>
                      <Text style={styles.positionSymbol}>{pos.symbol}</Text>
                      <View style={[styles.sideBadge, pos.side === "LONG" ? styles.longBadge : styles.shortBadge]}>
                        <Text style={[styles.sideText, pos.side === "LONG" ? styles.longText : styles.shortText]}>
                          {pos.side}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.closeButton} activeOpacity={0.7} onPress={() => handleClosePosition(pos.symbol)}>
                    <Icon name="x" size={14} color={colors.down} />
                    <Text style={styles.closeText}>Close</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.positionDivider} />

                <View style={styles.positionDetails}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Qty</Text>
                    <Text style={styles.detailValue}>{pos.qty}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Entry</Text>
                    <Text style={styles.detailValue}>${pos.entry.toLocaleString()}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Current</Text>
                    <Text style={styles.detailValue}>${pos.current.toLocaleString()}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>P&L</Text>
                    <Text style={[styles.detailValue, { color: pos.pnl >= 0 ? colors.up : colors.down }]}>
                      {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                    </Text>
                    <Text style={[styles.detailPct, { color: pos.pnl >= 0 ? colors.up : colors.down }]}>
                      {pos.pnlPct >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.xl, marginTop: spacing.lg, gap: spacing.sm },
  summaryCard: { width: "48%", flexGrow: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  summaryIconBg: { width: 32, height: 32, borderRadius: borderRadius.sm, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  summaryLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  summaryValue: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary, marginTop: 3, fontVariant: ["tabular-nums"] },
  marginBar: { marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  marginBarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  marginLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  marginBarLabel: { fontSize: fontSize.sm, color: colors.text.muted },
  marginBarPct: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text.primary },
  marginBarTrack: { height: 8, borderRadius: 4, backgroundColor: colors.bg.tertiary, overflow: "hidden" },
  marginBarFill: { height: "100%", borderRadius: 4, backgroundColor: colors.brand.primary },
  marginLegend: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fontSize.xs, color: colors.text.muted },
  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xxl, paddingBottom: 100 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  sectionCount: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text.muted, backgroundColor: colors.bg.tertiary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.xs, overflow: "hidden" },
  positionCard: { backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  positionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  positionLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  positionIconBg: { width: 40, height: 40, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  positionSymbol: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  sideBadge: { borderRadius: borderRadius.xs, paddingHorizontal: spacing.xs, paddingVertical: 1, marginTop: 2, alignSelf: "flex-start" },
  longBadge: { backgroundColor: "rgba(16, 185, 129, 0.12)" },
  shortBadge: { backgroundColor: "rgba(239, 68, 68, 0.12)" },
  sideText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  longText: { color: colors.up },
  shortText: { color: colors.down },
  closeButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(239, 68, 68, 0.12)", borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  closeText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.down },
  positionDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  positionDetails: { flexDirection: "row", justifyContent: "space-between" },
  detailCol: { alignItems: "center" },
  detailLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  detailValue: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text.primary, marginTop: 2, fontVariant: ["tabular-nums"] },
  detailPct: { fontSize: fontSize.xs, fontWeight: "600", marginTop: 1 },
});
