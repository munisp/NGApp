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
import { usePortfolio, useMarkets } from "../hooks/useApi";

const ICONS: Record<string, string> = {
  MAIZE: "M", GOLD: "Au", COFFEE: "C", CRUDE_OIL: "O",
  CARBON: "CO", WHEAT: "W", COCOA: "Co", SILVER: "Ag",
  NAT_GAS: "NG", TEA: "T",
};

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { data: portfolioData, refetch: refetchPortfolio } = usePortfolio();
  const { data: marketsData, refetch: refetchMarkets } = useMarkets();
  const [refreshing, setRefreshing] = React.useState(false);

  const positions = (portfolioData?.positions || []).map((p: any) => ({
    symbol: p.symbol,
    side: p.side === "BUY" ? "LONG" : p.side === "SELL" ? "SHORT" : p.side,
    qty: p.quantity,
    entry: p.averageEntryPrice,
    current: p.currentPrice,
    pnl: p.unrealizedPnl,
    pnlPct: p.unrealizedPnlPercent,
  }));

  const commodities = (marketsData as any)?.commodities || [];
  const watchlist = commodities.slice(0, 5).map((c: any) => ({
    symbol: c.symbol,
    name: c.name,
    price: c.lastPrice,
    change: c.changePercent24h,
    icon: ICONS[c.symbol] || c.symbol.charAt(0),
  }));

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([refetchPortfolio(), refetchMarkets()]).finally(() =>
      setRefreshing(false)
    );
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
