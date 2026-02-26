import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";

const positions = [
  { symbol: "MAIZE", side: "LONG" as const, qty: 100, entry: 282.0, current: 285.5, pnl: 350.0, pnlPct: 1.24, margin: 2820 },
  { symbol: "GOLD", side: "SHORT" as const, qty: 4, entry: 2349.8, current: 2345.6, pnl: 16.8, pnlPct: 0.18, margin: 469.96 },
  { symbol: "COFFEE", side: "LONG" as const, qty: 20, entry: 4518.5, current: 4520.0, pnl: 30.0, pnlPct: 0.03, margin: 9037 },
  { symbol: "CRUDE_OIL", side: "LONG" as const, qty: 200, entry: 76.5, current: 78.42, pnl: 384.0, pnlPct: 2.51, margin: 1224 },
];

export default function PortfolioScreen() {
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalMargin = positions.reduce((s, p) => s + p.margin, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={styles.summaryValue}>$156,420</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total P&L</Text>
            <Text style={[styles.summaryValue, { color: colors.up }]}>
              +${totalPnl.toFixed(0)}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Margin Used</Text>
            <Text style={styles.summaryValue}>${totalMargin.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Positions</Text>
            <Text style={styles.summaryValue}>{positions.length}</Text>
          </View>
        </View>

        {/* Margin Bar */}
        <View style={styles.marginBar}>
          <View style={styles.marginBarHeader}>
            <Text style={styles.marginBarLabel}>Margin Utilization</Text>
            <Text style={styles.marginBarPct}>13.8%</Text>
          </View>
          <View style={styles.marginBarTrack}>
            <View style={[styles.marginBarFill, { width: "13.8%" }]} />
          </View>
        </View>

        {/* Positions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Positions</Text>
          {positions.map((pos) => (
            <View key={pos.symbol} style={styles.positionCard}>
              <View style={styles.positionHeader}>
                <View style={styles.positionLeft}>
                  <Text style={styles.positionSymbol}>{pos.symbol}</Text>
                  <View style={[styles.sideBadge, pos.side === "LONG" ? styles.longBadge : styles.shortBadge]}>
                    <Text style={[styles.sideText, pos.side === "LONG" ? styles.longText : styles.shortText]}>
                      {pos.side}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeButton}>
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.positionDetails}>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Quantity</Text>
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
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  summaryRow: { flexDirection: "row", paddingHorizontal: spacing.xl, marginTop: spacing.md, gap: spacing.sm },
  summaryCard: { flex: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  summaryValue: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary, marginTop: 4, fontVariant: ["tabular-nums"] },
  marginBar: { marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  marginBarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  marginBarLabel: { fontSize: fontSize.sm, color: colors.text.muted },
  marginBarPct: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.primary },
  marginBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.bg.tertiary, overflow: "hidden" },
  marginBarFill: { height: "100%", borderRadius: 3, backgroundColor: colors.brand.primary },
  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xxl, paddingBottom: 100 },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, marginBottom: spacing.md },
  positionCard: { backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  positionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  positionLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  positionSymbol: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  sideBadge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  longBadge: { backgroundColor: "rgba(34, 197, 94, 0.15)" },
  shortBadge: { backgroundColor: "rgba(239, 68, 68, 0.15)" },
  sideText: { fontSize: fontSize.xs, fontWeight: "700" },
  longText: { color: colors.up },
  shortText: { color: colors.down },
  closeButton: { backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  closeText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.down },
  positionDetails: { flexDirection: "row", justifyContent: "space-between" },
  detailCol: { alignItems: "center" },
  detailLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  detailValue: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.primary, marginTop: 2, fontVariant: ["tabular-nums"] },
  detailPct: { fontSize: fontSize.xs, fontWeight: "500", marginTop: 1 },
});
