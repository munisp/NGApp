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
import { colors, spacing, fontSize, borderRadius, shadows } from "../styles/theme";
import { usePortfolio, useMarkets } from "../hooks/useApi";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

const SYMBOL_ICONS: Record<string, IconName> = {
  MAIZE: "wheat", GOLD: "gem", COFFEE: "coffee", CRUDE_OIL: "droplet",
  CARBON: "leaf", WHEAT: "wheat", COCOA: "coffee", SILVER: "gem",
  NAT_GAS: "flame", TEA: "leaf",
};

const SYMBOL_COLORS: Record<string, string> = {
  MAIZE: "#F59E0B", GOLD: "#EAB308", COFFEE: "#92400E", CRUDE_OIL: "#3B82F6",
  CARBON: "#10B981", WHEAT: "#D97706", COCOA: "#78350F", SILVER: "#94A3B8",
  NAT_GAS: "#EF4444", TEA: "#059669",
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
  }));

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([refetchPortfolio(), refetchMarkets()]).finally(() =>
      setRefreshing(false)
    );
  };

  const quickActions: { label: string; icon: IconName; color: string; bg: string; screen: string }[] = [
    { label: "Buy", icon: "trending-up", color: colors.up, bg: "rgba(16, 185, 129, 0.12)", screen: "Trade" },
    { label: "Sell", icon: "trending-down", color: colors.down, bg: "rgba(239, 68, 68, 0.12)", screen: "Trade" },
    { label: "Deposit", icon: "download", color: colors.info, bg: "rgba(59, 130, 246, 0.12)", screen: "Account" },
    { label: "Withdraw", icon: "upload", color: colors.purple, bg: "rgba(139, 92, 246, 0.12)", screen: "Account" },
  ];

  const totalValue = portfolioData?.totalValue ?? 156420.5;
  const unrealizedPnl = portfolioData?.unrealizedPnl ?? 2845.3;
  const availableBalance = portfolioData?.availableBalance ?? 98540;
  const marginUsed = portfolioData?.marginUsed ?? 13551;
  const pnlPct = totalValue > 0 ? ((unrealizedPnl / totalValue) * 100) : 1.85;

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
            <Icon name="bell" size={22} color={colors.text.secondary} />
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Portfolio Summary */}
        <View style={styles.portfolioCard}>
          <View style={styles.portfolioCardInner}>
            <View style={styles.portfolioLabelRow}>
              <Icon name="wallet" size={14} color={colors.text.muted} />
              <Text style={styles.portfolioLabel}>Portfolio Value</Text>
            </View>
            <Text style={styles.portfolioValue}>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <View style={styles.portfolioRow}>
              <View style={styles.pnlBadge}>
                <Icon name={unrealizedPnl >= 0 ? "trending-up" : "trending-down"} size={12} color={unrealizedPnl >= 0 ? colors.up : colors.down} />
                <Text style={[styles.pnlText, { color: unrealizedPnl >= 0 ? colors.up : colors.down }]}>{unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</Text>
              </View>
              <Text style={styles.portfolioSubtext}>24h</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.portfolioStats}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Available</Text>
                <Text style={styles.statValue}>${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Margin</Text>
                <Text style={styles.statValue}>${marginUsed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Positions</Text>
                <Text style={styles.statValue}>{positions.length}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.quickAction, { backgroundColor: action.bg }]}
                activeOpacity={0.7}
                onPress={() => (navigation as any).navigate(action.screen)}
              >
              <View style={styles.quickActionIcon}>
                <Icon name={action.icon} size={18} color={action.color} />
              </View>
              <Text style={[styles.quickActionText, { color: action.color }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Watchlist */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Watchlist</Text>
            <TouchableOpacity style={styles.seeAllButton} onPress={() => (navigation as any).navigate("Markets")}>
              <Text style={styles.seeAll}>See all</Text>
              <Icon name="chevron-right" size={14} color={colors.brand.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {watchlist.map((item) => {
              const iconName = SYMBOL_ICONS[item.symbol] || "circle-dot";
              const iconColor = SYMBOL_COLORS[item.symbol] || colors.text.muted;
              return (
                <TouchableOpacity
                  key={item.symbol}
                  style={styles.watchlistCard}
                  activeOpacity={0.7}
                  onPress={() => (navigation as any).navigate("TradeDetail", { symbol: item.symbol })}
                >
                  <View style={[styles.watchlistIconBg, { backgroundColor: iconColor + "18" }]}>
                    <Icon name={iconName} size={16} color={iconColor} />
                  </View>
                  <Text style={styles.watchlistSymbol}>{item.symbol}</Text>
                  <Text style={styles.watchlistPrice}>${item.price.toLocaleString()}</Text>
                  <View style={[styles.watchlistChangeBadge, { backgroundColor: item.change >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)" }]}>
                    <Text style={[styles.watchlistChange, { color: item.change >= 0 ? colors.up : colors.down }]}>
                      {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Open Positions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Open Positions</Text>
            <TouchableOpacity style={styles.seeAllButton} onPress={() => (navigation as any).navigate("Portfolio")}>
              <Text style={styles.seeAll}>See all</Text>
              <Icon name="chevron-right" size={14} color={colors.brand.primary} />
            </TouchableOpacity>
          </View>
          {positions.map((pos) => {
            const iconName = SYMBOL_ICONS[pos.symbol] || "circle-dot";
            const iconColor = SYMBOL_COLORS[pos.symbol] || colors.text.muted;
            return (
              <View key={pos.symbol} style={styles.positionRow}>
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
                <View style={styles.positionRight}>
                  <Text style={[styles.positionPnl, { color: pos.pnl >= 0 ? colors.up : colors.down }]}>
                    {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                  </Text>
                  <Text style={[styles.positionPnlPct, { color: pos.pnl >= 0 ? colors.up : colors.down }]}>
                    {pos.pnlPct >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Market Status */}
        <View style={styles.marketStatus}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Markets Open</Text>
          <View style={styles.statusSeparator} />
          <Icon name="clock" size={12} color={colors.text.muted} />
          <Text style={styles.statusText}>Next close in 6h 23m</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  greeting: { fontSize: fontSize.sm, color: colors.text.muted, letterSpacing: 0.3 },
  name: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary, marginTop: 2 },
  notifButton: { position: "relative", width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  notifBadge: { position: "absolute", top: 6, right: 6, backgroundColor: colors.down, borderRadius: 8, width: 16, height: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg.primary },
  notifBadgeText: { fontSize: 9, color: colors.white, fontWeight: "700" },
  portfolioCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg, borderRadius: borderRadius.xl, overflow: "hidden", ...shadows.lg },
  portfolioCardInner: { backgroundColor: colors.bg.card, borderRadius: borderRadius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  portfolioLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  portfolioLabel: { fontSize: fontSize.sm, color: colors.text.muted },
  portfolioValue: { fontSize: fontSize.display, fontWeight: "800", color: colors.text.primary, marginTop: spacing.xs, letterSpacing: -1 },
  portfolioRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: spacing.sm },
  pnlBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(16, 185, 129, 0.12)", borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  pnlText: { fontSize: fontSize.sm, color: colors.up, fontWeight: "600" },
  portfolioSubtext: { fontSize: fontSize.xs, color: colors.text.muted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  portfolioStats: { flexDirection: "row", justifyContent: "space-between" },
  stat: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  statValue: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary, marginTop: 3, fontVariant: ["tabular-nums"] },
  statDivider: { width: 1, backgroundColor: colors.border },
  quickActions: { flexDirection: "row", paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.sm },
  quickAction: { flex: 1, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: "center", gap: spacing.xs },
  quickActionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  quickActionText: { fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 0.3 },
  section: { marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  seeAllButton: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAll: { fontSize: fontSize.sm, color: colors.brand.primary, fontWeight: "600" },
  watchlistCard: { width: 130, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  watchlistIconBg: { width: 32, height: 32, borderRadius: borderRadius.sm, alignItems: "center", justifyContent: "center" },
  watchlistSymbol: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text.primary, marginTop: spacing.sm },
  watchlistPrice: { fontSize: fontSize.md, fontWeight: "600", color: colors.text.primary, marginTop: spacing.xs, fontVariant: ["tabular-nums"] },
  watchlistChangeBadge: { borderRadius: borderRadius.xs, paddingHorizontal: spacing.xs, paddingVertical: 2, marginTop: spacing.xs, alignSelf: "flex-start" },
  watchlistChange: { fontSize: fontSize.xs, fontWeight: "700" },
  positionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  positionLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  positionIconBg: { width: 40, height: 40, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  positionSymbol: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  sideBadge: { borderRadius: borderRadius.xs, paddingHorizontal: spacing.xs, paddingVertical: 1, marginTop: 2, alignSelf: "flex-start" },
  longBadge: { backgroundColor: "rgba(16, 185, 129, 0.12)" },
  shortBadge: { backgroundColor: "rgba(239, 68, 68, 0.12)" },
  sideText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  longText: { color: colors.up },
  shortText: { color: colors.down },
  positionRight: { alignItems: "flex-end" },
  positionPnl: { fontSize: fontSize.md, fontWeight: "700", fontVariant: ["tabular-nums"] },
  positionPnlPct: { fontSize: fontSize.xs, fontWeight: "600", marginTop: 2 },
  marketStatus: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl, gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.up },
  statusText: { fontSize: fontSize.xs, color: colors.text.muted },
  statusSeparator: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.text.muted, opacity: 0.5 },
});
