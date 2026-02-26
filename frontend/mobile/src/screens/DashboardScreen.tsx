import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";

const positions = [
  { symbol: "MAIZE", side: "LONG", qty: 100, entry: 282.0, current: 285.5, pnl: 350.0, pnlPct: 1.24 },
  { symbol: "GOLD", side: "SHORT", qty: 4, entry: 2349.8, current: 2345.6, pnl: 16.8, pnlPct: 0.18 },
  { symbol: "COFFEE", side: "LONG", qty: 20, entry: 4518.5, current: 4520.0, pnl: 30.0, pnlPct: 0.03 },
  { symbol: "CRUDE_OIL", side: "LONG", qty: 200, entry: 76.5, current: 78.42, pnl: 384.0, pnlPct: 2.51 },
];

const watchlist = [
  { symbol: "MAIZE", name: "Maize", price: 285.5, change: 1.15, icon: "🌾" },
  { symbol: "GOLD", name: "Gold", price: 2345.6, change: 0.53, icon: "🥇" },
  { symbol: "COFFEE", name: "Coffee", price: 4520.0, change: 1.01, icon: "☕" },
  { symbol: "CRUDE_OIL", name: "Crude Oil", price: 78.42, change: 1.59, icon: "⚡" },
  { symbol: "CARBON", name: "Carbon Credits", price: 65.2, change: 1.32, icon: "🌿" },
];

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.name}>Alex Trader</Text>
          </View>
          <TouchableOpacity
            style={styles.notifButton}
            onPress={() => (navigation as any).navigate("Notifications")}
          >
            <Text style={styles.notifIcon}>🔔</Text>
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Portfolio Summary */}
        <View style={styles.portfolioCard}>
          <Text style={styles.portfolioLabel}>Portfolio Value</Text>
          <Text style={styles.portfolioValue}>$156,420.50</Text>
          <View style={styles.portfolioRow}>
            <View style={styles.pnlBadge}>
              <Text style={styles.pnlText}>+$2,845.30 (+1.85%)</Text>
            </View>
            <Text style={styles.portfolioSubtext}>24h</Text>
          </View>

          <View style={styles.portfolioStats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Available</Text>
              <Text style={styles.statValue}>$98,540.20</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Margin Used</Text>
              <Text style={styles.statValue}>$13,550.96</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Positions</Text>
              <Text style={styles.statValue}>4</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.quickAction, styles.buyAction]}>
            <Text style={styles.quickActionText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickAction, styles.sellAction]}>
            <Text style={styles.quickActionText}>Sell</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickAction, styles.depositAction]}>
            <Text style={styles.quickActionText}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickAction, styles.withdrawAction]}>
            <Text style={styles.quickActionText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* Watchlist */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Watchlist</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {watchlist.map((item) => (
              <TouchableOpacity
                key={item.symbol}
                style={styles.watchlistCard}
                onPress={() => (navigation as any).navigate("TradeDetail", { symbol: item.symbol })}
              >
                <Text style={styles.watchlistIcon}>{item.icon}</Text>
                <Text style={styles.watchlistSymbol}>{item.symbol}</Text>
                <Text style={styles.watchlistPrice}>${item.price.toLocaleString()}</Text>
                <Text style={[styles.watchlistChange, { color: item.change >= 0 ? colors.up : colors.down }]}>
                  {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Open Positions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Open Positions</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {positions.map((pos) => (
            <View key={pos.symbol} style={styles.positionRow}>
              <View style={styles.positionLeft}>
                <Text style={styles.positionSymbol}>{pos.symbol}</Text>
                <View style={[styles.sideBadge, pos.side === "LONG" ? styles.longBadge : styles.shortBadge]}>
                  <Text style={[styles.sideText, pos.side === "LONG" ? styles.longText : styles.shortText]}>
                    {pos.side}
                  </Text>
                </View>
              </View>
              <View style={styles.positionRight}>
                <Text style={[styles.positionPnl, { color: pos.pnl >= 0 ? colors.up : colors.down }]}>
                  {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                </Text>
                <Text style={[styles.positionPnlPct, { color: pos.pnl >= 0 ? colors.up : colors.down }]}>
                  {pos.pnlPct >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Market Status */}
        <View style={styles.marketStatus}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Markets Open &middot; Next close in 6h 23m</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  greeting: { fontSize: fontSize.sm, color: colors.text.muted },
  name: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary },
  notifButton: { position: "relative", padding: spacing.sm },
  notifIcon: { fontSize: 24 },
  notifBadge: { position: "absolute", top: 2, right: 2, backgroundColor: colors.down, borderRadius: 10, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  notifBadgeText: { fontSize: 10, color: colors.white, fontWeight: "700" },
  portfolioCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  portfolioLabel: { fontSize: fontSize.sm, color: colors.text.muted },
  portfolioValue: { fontSize: fontSize.xxxl, fontWeight: "700", color: colors.text.primary, marginTop: 4 },
  portfolioRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: spacing.sm },
  pnlBadge: { backgroundColor: "rgba(34, 197, 94, 0.15)", borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  pnlText: { fontSize: fontSize.sm, color: colors.up, fontWeight: "600" },
  portfolioSubtext: { fontSize: fontSize.xs, color: colors.text.muted },
  portfolioStats: { flexDirection: "row", marginTop: spacing.xl, justifyContent: "space-between" },
  stat: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  statValue: { fontSize: fontSize.md, fontWeight: "600", color: colors.text.primary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  quickActions: { flexDirection: "row", paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.sm },
  quickAction: { flex: 1, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: "center" },
  buyAction: { backgroundColor: "rgba(34, 197, 94, 0.15)" },
  sellAction: { backgroundColor: "rgba(239, 68, 68, 0.15)" },
  depositAction: { backgroundColor: "rgba(59, 130, 246, 0.15)" },
  withdrawAction: { backgroundColor: "rgba(168, 85, 247, 0.15)" },
  quickActionText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.primary },
  section: { marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  seeAll: { fontSize: fontSize.sm, color: colors.brand.primary },
  watchlistCard: { width: 120, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.md, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  watchlistIcon: { fontSize: 20 },
  watchlistSymbol: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text.primary, marginTop: spacing.xs },
  watchlistPrice: { fontSize: fontSize.md, fontWeight: "600", color: colors.text.primary, marginTop: spacing.xs, fontVariant: ["tabular-nums"] },
  watchlistChange: { fontSize: fontSize.xs, fontWeight: "600", marginTop: 2 },
  positionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  positionLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  positionSymbol: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  sideBadge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  longBadge: { backgroundColor: "rgba(34, 197, 94, 0.15)" },
  shortBadge: { backgroundColor: "rgba(239, 68, 68, 0.15)" },
  sideText: { fontSize: fontSize.xs, fontWeight: "700" },
  longText: { color: colors.up },
  shortText: { color: colors.down },
  positionRight: { alignItems: "flex-end" },
  positionPnl: { fontSize: fontSize.md, fontWeight: "600", fontVariant: ["tabular-nums"] },
  positionPnlPct: { fontSize: fontSize.xs, fontWeight: "500" },
  marketStatus: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.up },
  statusText: { fontSize: fontSize.xs, color: colors.text.muted },
});
