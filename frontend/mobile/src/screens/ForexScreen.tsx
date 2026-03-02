import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";
import Icon from "../components/Icon";

// ── Types ───────────────────────────────────────────────────────────────

interface FXPair {
  id: string;
  symbol: string;
  displayName: string;
  category: string;
  bid: number;
  ask: number;
  changePercent: number;
  spreadTypical: number;
  maxLeverage: number;
  pipSize: number;
}

interface FXPosition {
  id: string;
  pair: string;
  side: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPips: number;
  leverage: number;
}

// ── Mock Data ───────────────────────────────────────────────────────────

const MOCK_PAIRS: FXPair[] = [
  { id: "fx-001", symbol: "EUR/USD", displayName: "Euro / US Dollar", category: "major", bid: 1.0853, ask: 1.0855, changePercent: 0.17, spreadTypical: 1.2, maxLeverage: 200, pipSize: 0.0001 },
  { id: "fx-002", symbol: "GBP/USD", displayName: "British Pound / US Dollar", category: "major", bid: 1.2641, ask: 1.2644, changePercent: 0.19, spreadTypical: 1.5, maxLeverage: 200, pipSize: 0.0001 },
  { id: "fx-003", symbol: "USD/JPY", displayName: "US Dollar / Japanese Yen", category: "major", bid: 149.85, ask: 149.87, changePercent: -0.15, spreadTypical: 1.0, maxLeverage: 200, pipSize: 0.01 },
  { id: "fx-004", symbol: "USD/CHF", displayName: "US Dollar / Swiss Franc", category: "major", bid: 0.8823, ask: 0.8826, changePercent: 0.08, spreadTypical: 1.5, maxLeverage: 200, pipSize: 0.0001 },
  { id: "fx-011", symbol: "USD/NGN", displayName: "US Dollar / Nigerian Naira", category: "african", bid: 1580.50, ask: 1582.00, changePercent: 0.22, spreadTypical: 150, maxLeverage: 50, pipSize: 0.01 },
  { id: "fx-012", symbol: "EUR/NGN", displayName: "Euro / Nigerian Naira", category: "african", bid: 1715.20, ask: 1717.20, changePercent: 0.30, spreadTypical: 200, maxLeverage: 50, pipSize: 0.01 },
  { id: "fx-013", symbol: "GBP/NGN", displayName: "British Pound / Nigerian Naira", category: "african", bid: 1998.50, ask: 2001.00, changePercent: 0.20, spreadTypical: 250, maxLeverage: 50, pipSize: 0.01 },
  { id: "fx-008", symbol: "EUR/GBP", displayName: "Euro / British Pound", category: "minor", bid: 0.8586, ask: 0.8589, changePercent: -0.05, spreadTypical: 1.8, maxLeverage: 100, pipSize: 0.0001 },
  { id: "fx-017", symbol: "USD/TRY", displayName: "US Dollar / Turkish Lira", category: "exotic", bid: 32.45, ask: 32.52, changePercent: 0.35, spreadTypical: 60, maxLeverage: 30, pipSize: 0.01 },
];

const MOCK_POSITIONS: FXPosition[] = [
  { id: "fxp-001", pair: "EUR/USD", side: "BUY", lotSize: 1.0, entryPrice: 1.0835, currentPrice: 1.0853, unrealizedPnl: 180.0, unrealizedPips: 18, leverage: 100 },
  { id: "fxp-002", pair: "GBP/USD", side: "SELL", lotSize: 0.5, entryPrice: 1.2668, currentPrice: 1.2641, unrealizedPnl: 135.0, unrealizedPips: 27, leverage: 100 },
  { id: "fxp-003", pair: "USD/NGN", side: "BUY", lotSize: 2.0, entryPrice: 1575.0, currentPrice: 1580.5, unrealizedPnl: 73.33, unrealizedPips: 550, leverage: 50 },
];

// ── Helpers ─────────────────────────────────────────────────────────────

function formatFXPrice(price: number, pipSize: number): string {
  const decimals = pipSize < 0.001 ? 5 : pipSize < 0.1 ? 3 : 2;
  return price.toFixed(decimals);
}

function formatUSD(value: number): string {
  return `$${value.toFixed(2)}`;
}

// ── Main Component ──────────────────────────────────────────────────────

type TabType = "pairs" | "positions" | "trade";

export default function ForexScreen() {
  const [tab, setTab] = useState<TabType>("pairs");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedPair, setSelectedPair] = useState<FXPair | null>(null);
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY");
  const [orderLots, setOrderLots] = useState("0.10");
  const [orderLeverage, setOrderLeverage] = useState("100");

  const filteredPairs = categoryFilter === "all"
    ? MOCK_PAIRS
    : MOCK_PAIRS.filter(p => p.category === categoryFilter);

  const totalPnl = MOCK_POSITIONS.reduce((s, p) => s + p.unrealizedPnl, 0);

  const handleSelectPair = (pair: FXPair) => {
    setSelectedPair(pair);
    setTab("trade");
  };

  const handlePlaceOrder = () => {
    if (!selectedPair) return;
    Alert.alert(
      "Confirm FX Order",
      `${orderSide} ${orderLots} lots of ${selectedPair.symbol}\nLeverage: 1:${orderLeverage}\nEst. Margin: ${formatUSD((parseFloat(orderLots) * 100000 * selectedPair.bid) / parseInt(orderLeverage))}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => {
          Alert.alert("Success", `${orderSide} order for ${selectedPair.symbol} placed (demo)`);
        }},
      ]
    );
  };

  const handleClosePosition = (pos: FXPosition) => {
    Alert.alert(
      "Close Position",
      `Close ${pos.pair} ${pos.side} ${pos.lotSize} lots?\nP&L: ${formatUSD(pos.unrealizedPnl)}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Close", style: "destructive", onPress: () => {
          Alert.alert("Success", `Position ${pos.pair} closed (demo)`);
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Icon name="dollar" size={20} color="#3B82F6" />
          </View>
          <View>
            <Text style={styles.title}>Forex Trading</Text>
            <Text style={styles.subtitle}>20+ currency pairs</Text>
          </View>
        </View>
      </View>

      {/* Account Summary Bar */}
      <View style={styles.accountBar}>
        <View style={styles.accountItem}>
          <Text style={styles.accountLabel}>Balance</Text>
          <Text style={styles.accountValue}>$50,000</Text>
        </View>
        <View style={styles.accountDivider} />
        <View style={styles.accountItem}>
          <Text style={styles.accountLabel}>Equity</Text>
          <Text style={[styles.accountValue, { color: colors.up }]}>$51,246</Text>
        </View>
        <View style={styles.accountDivider} />
        <View style={styles.accountItem}>
          <Text style={styles.accountLabel}>P&L</Text>
          <Text style={[styles.accountValue, { color: totalPnl >= 0 ? colors.up : colors.down }]}>
            {totalPnl >= 0 ? "+" : ""}{formatUSD(totalPnl)}
          </Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {([
          { id: "pairs" as TabType, label: "Pairs", icon: "globe" },
          { id: "positions" as TabType, label: `Positions (${MOCK_POSITIONS.length})`, icon: "layers" },
          { id: "trade" as TabType, label: "Trade", icon: "trending-up" },
        ]).map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabButton, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
            activeOpacity={0.7}
          >
            <Icon name={t.icon} size={14} color={tab === t.id ? "#3B82F6" : colors.text.muted} />
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === "pairs" && (
        <View style={styles.content}>
          {/* Category Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {[
              { key: "all", label: "All" },
              { key: "major", label: "Major" },
              { key: "african", label: "African" },
              { key: "minor", label: "Minor" },
              { key: "exotic", label: "Exotic" },
            ].map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.filterChip, categoryFilter === cat.key && styles.filterChipActive]}
                onPress={() => setCategoryFilter(cat.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, categoryFilter === cat.key && styles.filterChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Pair List */}
          <FlatList
            data={filteredPairs}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pairCard}
                onPress={() => handleSelectPair(item)}
                activeOpacity={0.7}
              >
                <View style={styles.pairLeft}>
                  <View style={[styles.pairBadge, {
                    backgroundColor: item.category === "major" ? "rgba(59, 130, 246, 0.12)" :
                      item.category === "african" ? "rgba(16, 185, 129, 0.12)" :
                      item.category === "minor" ? "rgba(139, 92, 246, 0.12)" : "rgba(245, 158, 11, 0.12)"
                  }]}>
                    <Text style={[styles.pairBadgeText, {
                      color: item.category === "major" ? "#3B82F6" :
                        item.category === "african" ? "#10B981" :
                        item.category === "minor" ? "#8B5CF6" : "#F59E0B"
                    }]}>{item.symbol.split("/")[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.pairSymbol}>{item.symbol}</Text>
                    <Text style={styles.pairName}>{item.displayName}</Text>
                  </View>
                </View>
                <View style={styles.pairRight}>
                  <View style={styles.pairPrices}>
                    <Text style={styles.pairBid}>{formatFXPrice(item.bid, item.pipSize)}</Text>
                    <Text style={styles.pairAsk}>{formatFXPrice(item.ask, item.pipSize)}</Text>
                  </View>
                  <View style={[styles.changeBadge, { backgroundColor: item.changePercent >= 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)" }]}>
                    <Icon name={item.changePercent >= 0 ? "trending-up" : "trending-down"} size={10} color={item.changePercent >= 0 ? colors.up : colors.down} />
                    <Text style={[styles.changeText, { color: item.changePercent >= 0 ? colors.up : colors.down }]}>
                      {item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {tab === "positions" && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {MOCK_POSITIONS.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="layers" size={40} color={colors.text.muted} />
              <Text style={styles.emptyTitle}>No Open Positions</Text>
              <Text style={styles.emptySubtitle}>Select a pair and place a trade</Text>
            </View>
          ) : (
            MOCK_POSITIONS.map(pos => (
              <TouchableOpacity
                key={pos.id}
                style={styles.positionCard}
                onLongPress={() => handleClosePosition(pos)}
                activeOpacity={0.8}
              >
                <View style={styles.posHeader}>
                  <View style={styles.posLeft}>
                    <Text style={styles.posPair}>{pos.pair}</Text>
                    <View style={[styles.posSideBadge, { backgroundColor: pos.side === "BUY" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)" }]}>
                      <Text style={[styles.posSideText, { color: pos.side === "BUY" ? colors.up : colors.down }]}>{pos.side}</Text>
                    </View>
                  </View>
                  <View style={styles.posRight}>
                    <Text style={[styles.posPnl, { color: pos.unrealizedPnl >= 0 ? colors.up : colors.down }]}>
                      {pos.unrealizedPnl >= 0 ? "+" : ""}{formatUSD(pos.unrealizedPnl)}
                    </Text>
                    <Text style={[styles.posPips, { color: pos.unrealizedPips >= 0 ? colors.up : colors.down }]}>
                      {pos.unrealizedPips >= 0 ? "+" : ""}{pos.unrealizedPips} pips
                    </Text>
                  </View>
                </View>
                <View style={styles.posDetails}>
                  <View style={styles.posDetail}>
                    <Text style={styles.posDetailLabel}>Lots</Text>
                    <Text style={styles.posDetailValue}>{pos.lotSize.toFixed(2)}</Text>
                  </View>
                  <View style={styles.posDetail}>
                    <Text style={styles.posDetailLabel}>Entry</Text>
                    <Text style={styles.posDetailValue}>{pos.entryPrice}</Text>
                  </View>
                  <View style={styles.posDetail}>
                    <Text style={styles.posDetailLabel}>Current</Text>
                    <Text style={styles.posDetailValue}>{pos.currentPrice}</Text>
                  </View>
                  <View style={styles.posDetail}>
                    <Text style={styles.posDetailLabel}>Leverage</Text>
                    <Text style={styles.posDetailValue}>1:{pos.leverage}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => handleClosePosition(pos)}
                  activeOpacity={0.7}
                >
                  <Icon name="x" size={14} color={colors.down} />
                  <Text style={styles.closeText}>Close Position</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {tab === "trade" && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {selectedPair ? (
            <>
              {/* Selected Pair Header */}
              <View style={styles.tradePairHeader}>
                <Text style={styles.tradePairSymbol}>{selectedPair.symbol}</Text>
                <Text style={styles.tradePairName}>{selectedPair.displayName}</Text>
              </View>

              {/* Bid / Ask */}
              <View style={styles.bidAskRow}>
                <View style={[styles.bidAskBox, { borderColor: "rgba(16, 185, 129, 0.2)" }]}>
                  <Text style={styles.bidAskLabel}>BID</Text>
                  <Text style={[styles.bidAskPrice, { color: colors.up }]}>{formatFXPrice(selectedPair.bid, selectedPair.pipSize)}</Text>
                </View>
                <View style={styles.spreadBox}>
                  <Text style={styles.spreadLabel}>SPREAD</Text>
                  <Text style={styles.spreadValue}>{selectedPair.spreadTypical}</Text>
                </View>
                <View style={[styles.bidAskBox, { borderColor: "rgba(239, 68, 68, 0.2)" }]}>
                  <Text style={styles.bidAskLabel}>ASK</Text>
                  <Text style={[styles.bidAskPrice, { color: colors.down }]}>{formatFXPrice(selectedPair.ask, selectedPair.pipSize)}</Text>
                </View>
              </View>

              {/* Buy / Sell Toggle */}
              <View style={styles.sideToggle}>
                <TouchableOpacity
                  style={[styles.sideBtn, orderSide === "BUY" && { backgroundColor: colors.up }]}
                  onPress={() => setOrderSide("BUY")}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sideBtnText, orderSide === "BUY" && { color: "#fff" }]}>BUY</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sideBtn, orderSide === "SELL" && { backgroundColor: colors.down }]}
                  onPress={() => setOrderSide("SELL")}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sideBtnText, orderSide === "SELL" && { color: "#fff" }]}>SELL</Text>
                </TouchableOpacity>
              </View>

              {/* Lot Size */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Lot Size</Text>
                <TextInput
                  style={styles.input}
                  value={orderLots}
                  onChangeText={setOrderLots}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.text.muted}
                />
                <View style={styles.lotPresets}>
                  {["0.01", "0.10", "0.50", "1.00"].map(l => (
                    <TouchableOpacity
                      key={l}
                      style={[styles.presetBtn, orderLots === l && styles.presetBtnActive]}
                      onPress={() => setOrderLots(l)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetText, orderLots === l && styles.presetTextActive]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Leverage */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Leverage</Text>
                <View style={styles.leverageRow}>
                  {["50", "100", "200"].map(lev => (
                    <TouchableOpacity
                      key={lev}
                      style={[styles.leverageBtn, orderLeverage === lev && styles.leverageBtnActive]}
                      onPress={() => setOrderLeverage(lev)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.leverageBtnText, orderLeverage === lev && styles.leverageBtnTextActive]}>1:{lev}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Margin Estimate */}
              <View style={styles.marginEstimate}>
                <Text style={styles.marginLabel}>Estimated Margin</Text>
                <Text style={styles.marginValue}>
                  {formatUSD((parseFloat(orderLots) * 100000 * selectedPair.bid) / parseInt(orderLeverage))}
                </Text>
              </View>

              {/* Place Order Button */}
              <TouchableOpacity
                style={[styles.placeOrderBtn, { backgroundColor: orderSide === "BUY" ? colors.up : colors.down }]}
                onPress={handlePlaceOrder}
                activeOpacity={0.8}
              >
                <Icon name={orderSide === "BUY" ? "trending-up" : "trending-down"} size={18} color="#fff" />
                <Text style={styles.placeOrderText}>{orderSide} {selectedPair.symbol}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="dollar" size={40} color={colors.text.muted} />
              <Text style={styles.emptyTitle}>Select a Currency Pair</Text>
              <Text style={styles.emptySubtitle}>Go to the Pairs tab to choose a pair to trade</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerIcon: { width: 42, height: 42, borderRadius: borderRadius.md, backgroundColor: "rgba(59, 130, 246, 0.12)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },

  // Account Bar
  accountBar: { flexDirection: "row", marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  accountItem: { flex: 1, alignItems: "center" },
  accountLabel: { fontSize: 10, color: colors.text.muted, textTransform: "uppercase", fontWeight: "600" },
  accountValue: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary, marginTop: 2 },
  accountDivider: { width: 1, backgroundColor: colors.border },

  // Tab Bar
  tabBar: { flexDirection: "row", marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: 3, borderWidth: 1, borderColor: colors.border },
  tabButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  tabActive: { backgroundColor: "rgba(59, 130, 246, 0.12)" },
  tabText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text.muted },
  tabTextActive: { color: "#3B82F6" },

  content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md },

  // Filter
  filterRow: { marginBottom: spacing.md, flexGrow: 0 },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  filterChipActive: { backgroundColor: "rgba(59, 130, 246, 0.12)", borderColor: "rgba(59, 130, 246, 0.3)" },
  filterChipText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text.muted },
  filterChipTextActive: { color: "#3B82F6" },

  // Pair Card
  pairCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  pairLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pairBadge: { width: 40, height: 40, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  pairBadgeText: { fontSize: fontSize.xs, fontWeight: "800" },
  pairSymbol: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  pairName: { fontSize: 10, color: colors.text.muted, marginTop: 1 },
  pairRight: { alignItems: "flex-end" },
  pairPrices: { flexDirection: "row", gap: spacing.sm },
  pairBid: { fontSize: fontSize.sm, fontWeight: "700", color: colors.up, fontVariant: ["tabular-nums"] },
  pairAsk: { fontSize: fontSize.sm, fontWeight: "700", color: colors.down, fontVariant: ["tabular-nums"] },
  changeBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  changeText: { fontSize: 10, fontWeight: "700" },

  // Positions
  positionCard: { backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  posHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  posLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  posPair: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  posSideBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  posSideText: { fontSize: 10, fontWeight: "800" },
  posRight: { alignItems: "flex-end" },
  posPnl: { fontSize: fontSize.lg, fontWeight: "700" },
  posPips: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  posDetails: { flexDirection: "row", marginTop: spacing.md, gap: spacing.lg },
  posDetail: {},
  posDetailLabel: { fontSize: 9, color: colors.text.muted, textTransform: "uppercase", fontWeight: "600" },
  posDetailValue: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.primary, marginTop: 1, fontVariant: ["tabular-nums"] },
  closeButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginTop: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)" },
  closeText: { fontSize: fontSize.xs, fontWeight: "700", color: colors.down },

  // Trade
  tradePairHeader: { alignItems: "center", paddingVertical: spacing.lg },
  tradePairSymbol: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.text.primary },
  tradePairName: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },

  bidAskRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bidAskBox: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.bg.card, borderWidth: 1 },
  bidAskLabel: { fontSize: 9, color: colors.text.muted, fontWeight: "600", textTransform: "uppercase" },
  bidAskPrice: { fontSize: fontSize.xl, fontWeight: "800", marginTop: 2, fontVariant: ["tabular-nums"] },
  spreadBox: { alignItems: "center", paddingHorizontal: spacing.sm },
  spreadLabel: { fontSize: 8, color: colors.text.muted, fontWeight: "600" },
  spreadValue: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text.secondary, marginTop: 1 },

  sideToggle: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.sm },
  sideBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border },
  sideBtnText: { fontSize: fontSize.md, fontWeight: "800", color: colors.text.muted },

  inputGroup: { marginTop: spacing.lg },
  inputLabel: { fontSize: 10, color: colors.text.muted, textTransform: "uppercase", fontWeight: "600", marginBottom: spacing.xs },
  input: { height: 48, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  lotPresets: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  presetBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.xs, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border },
  presetBtnActive: { borderColor: "rgba(59, 130, 246, 0.5)", backgroundColor: "rgba(59, 130, 246, 0.1)" },
  presetText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.muted },
  presetTextActive: { color: "#3B82F6" },

  leverageRow: { flexDirection: "row", gap: spacing.sm },
  leverageBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border },
  leverageBtnActive: { borderColor: "rgba(59, 130, 246, 0.5)", backgroundColor: "rgba(59, 130, 246, 0.1)" },
  leverageBtnText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text.muted },
  leverageBtnTextActive: { color: "#3B82F6" },

  marginEstimate: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border },
  marginLabel: { fontSize: fontSize.sm, color: colors.text.muted },
  marginValue: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },

  placeOrderBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.lg, borderRadius: borderRadius.lg },
  placeOrderText: { fontSize: fontSize.lg, fontWeight: "800", color: "#fff" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text.secondary, marginTop: spacing.md },
  emptySubtitle: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: spacing.xs },
});
