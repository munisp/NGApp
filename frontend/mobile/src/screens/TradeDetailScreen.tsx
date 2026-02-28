import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, spacing, fontSize, borderRadius, shadows } from "../styles/theme";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "TradeDetail">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SYMBOL_ICONS: Record<string, IconName> = {
  MAIZE: "wheat", GOLD: "gem", COFFEE: "coffee", CRUDE_OIL: "droplet", CARBON: "leaf",
};
const SYMBOL_COLORS: Record<string, string> = {
  MAIZE: "#F59E0B", GOLD: "#EAB308", COFFEE: "#92400E", CRUDE_OIL: "#3B82F6", CARBON: "#10B981",
};

const commodityData: Record<string, {
  name: string;
  price: number;
  change: number;
  high: number;
  low: number;
  volume: string;
  unit: string;
}> = {
  MAIZE: { name: "Maize (Corn)", price: 285.50, change: 1.15, high: 287.00, low: 281.00, volume: "45.2K", unit: "MT" },
  GOLD: { name: "Gold", price: 2345.60, change: 0.53, high: 2352.00, low: 2330.00, volume: "89.2K", unit: "OZ" },
  COFFEE: { name: "Coffee Arabica", price: 4520.00, change: 1.01, high: 4535.00, low: 4470.00, volume: "18.9K", unit: "MT" },
  CRUDE_OIL: { name: "Crude Oil (WTI)", price: 78.42, change: 1.59, high: 79.10, low: 76.80, volume: "125.8K", unit: "BBL" },
  CARBON: { name: "Carbon Credits", price: 65.20, change: 1.32, high: 65.80, low: 64.10, volume: "15.6K", unit: "TCO2" },
};

export default function TradeDetailScreen({ route }: Props) {
  const { symbol } = route.params;
  const data = commodityData[symbol] ?? commodityData.MAIZE;
  const [timeframe, setTimeframe] = useState("1H");
  const iconName = SYMBOL_ICONS[symbol] || "circle-dot";
  const iconColor = SYMBOL_COLORS[symbol] || colors.text.muted;

  const timeframes = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];

  // Mock orderbook data
  const asks = Array.from({ length: 8 }, (_, i) => ({
    price: (data.price + (i + 1) * data.price * 0.001).toFixed(2),
    qty: Math.floor(Math.random() * 500 + 50),
  }));
  const bids = Array.from({ length: 8 }, (_, i) => ({
    price: (data.price - (i + 1) * data.price * 0.001).toFixed(2),
    qty: Math.floor(Math.random() * 500 + 50),
  }));

  const maxQty = Math.max(...asks.map((a) => a.qty), ...bids.map((b) => b.qty));

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Symbol Header */}
      <View style={styles.symbolHeader}>
        <View style={styles.symbolLeft}>
          <View style={[styles.symbolIconBg, { backgroundColor: iconColor + "18" }]}>
            <Icon name={iconName} size={22} color={iconColor} />
          </View>
          <View>
            <Text style={styles.symbolText}>{symbol}</Text>
            <Text style={styles.symbolName}>{data.name}</Text>
          </View>
        </View>
        <View style={styles.symbolRight}>
          <Text style={styles.price}>${data.price.toLocaleString()}</Text>
          <View style={[styles.changeBadge, { backgroundColor: data.change >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)" }]}>
            <Icon name={data.change >= 0 ? "trending-up" : "trending-down"} size={10} color={data.change >= 0 ? colors.up : colors.down} />
            <Text style={[styles.change, { color: data.change >= 0 ? colors.up : colors.down }]}>
              {data.change >= 0 ? "+" : ""}{data.change.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {[
          { label: "24h High", value: `$${data.high.toLocaleString()}`, icon: "trending-up" as IconName, color: colors.up },
          { label: "24h Low", value: `$${data.low.toLocaleString()}`, icon: "trending-down" as IconName, color: colors.down },
          { label: "Volume", value: `${data.volume} ${data.unit}`, icon: "bar-chart" as IconName, color: colors.info },
        ].map((stat) => (
          <View key={stat.label} style={styles.statItem}>
            <Icon name={stat.icon} size={12} color={stat.color} />
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>

      {/* Chart Placeholder */}
      <View style={styles.chartContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeframes}>
          {timeframes.map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[styles.tfButton, timeframe === tf && styles.tfActive]}
              onPress={() => setTimeframe(tf)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>{tf}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.chart}>
          <View style={styles.chartLine} />
          <Icon name="candlestick" size={32} color={colors.text.muted} />
          <Text style={styles.chartPlaceholder}>Interactive Chart</Text>
          <Text style={styles.chartSubtext}>Candlestick / Line chart renders here</Text>
        </View>
      </View>

      {/* Order Book */}
      <View style={styles.orderBookContainer}>
        <View style={styles.sectionHeader}>
          <Icon name="layers" size={16} color={colors.text.primary} />
          <Text style={styles.sectionTitle}>Order Book</Text>
        </View>
        <View style={styles.orderBook}>
          {/* Asks */}
          <View style={styles.bookSide}>
            <View style={styles.bookHeader}>
              <Text style={styles.bookHeaderText}>Price (USD)</Text>
              <Text style={styles.bookHeaderText}>Quantity</Text>
            </View>
            {asks.reverse().map((ask, i) => (
              <View key={`ask-${i}`} style={styles.bookRow}>
                <View style={[styles.bookDepthBar, styles.askDepthBar, { width: `${(ask.qty / maxQty) * 100}%` }]} />
                <Text style={[styles.bookPrice, { color: colors.down }]}>{ask.price}</Text>
                <Text style={styles.bookQty}>{ask.qty}</Text>
              </View>
            ))}
          </View>

          {/* Spread */}
          <View style={styles.spreadRow}>
            <View style={styles.spreadLeft}>
              <Icon name="arrow-right" size={14} color={colors.brand.primary} />
              <Text style={styles.spreadPrice}>${data.price.toFixed(2)}</Text>
            </View>
            <Text style={styles.spreadLabel}>Spread: ${(data.price * 0.002).toFixed(2)}</Text>
          </View>

          {/* Bids */}
          <View style={styles.bookSide}>
            {bids.map((bid, i) => (
              <View key={`bid-${i}`} style={styles.bookRow}>
                <View style={[styles.bookDepthBar, styles.bidDepthBar, { width: `${(bid.qty / maxQty) * 100}%` }]} />
                <Text style={[styles.bookPrice, { color: colors.up }]}>{bid.price}</Text>
                <Text style={styles.bookQty}>{bid.qty}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Trade Buttons */}
      <View style={styles.tradeButtons}>
        <TouchableOpacity style={[styles.tradeButton, styles.buyButton]} activeOpacity={0.8}>
          <Icon name="trending-up" size={18} color={colors.white} />
          <Text style={styles.tradeButtonText}>Buy / Long</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tradeButton, styles.sellButton]} activeOpacity={0.8}>
          <Icon name="trending-down" size={18} color={colors.white} />
          <Text style={styles.tradeButtonText}>Sell / Short</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  symbolHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  symbolLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  symbolIconBg: { width: 48, height: 48, borderRadius: borderRadius.lg, alignItems: "center", justifyContent: "center" },
  symbolText: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary },
  symbolName: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 1 },
  symbolRight: { alignItems: "flex-end" },
  price: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.text.primary, fontVariant: ["tabular-nums"], letterSpacing: -0.5 },
  changeBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: borderRadius.xs, paddingHorizontal: spacing.sm, paddingVertical: 3, marginTop: 3 },
  change: { fontSize: fontSize.sm, fontWeight: "700" },
  statsRow: { flexDirection: "row", paddingHorizontal: spacing.xl, gap: spacing.sm },
  statItem: { flex: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border, gap: 3 },
  statLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  statValue: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  chartContainer: { marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  timeframes: { marginBottom: spacing.sm },
  tfButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md, marginRight: spacing.xs },
  tfActive: { backgroundColor: colors.bg.tertiary },
  tfText: { fontSize: fontSize.xs, fontWeight: "700", color: colors.text.muted },
  tfTextActive: { color: colors.text.primary },
  chart: { height: 260, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  chartLine: { position: "absolute", left: 0, right: 0, top: "50%", height: 1, backgroundColor: colors.brand.primary, opacity: 0.2 },
  chartPlaceholder: { fontSize: fontSize.md, fontWeight: "600", color: colors.text.muted },
  chartSubtext: { fontSize: fontSize.xs, color: colors.text.muted },
  orderBookContainer: { marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  orderBook: { backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  bookSide: {},
  bookHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs, paddingHorizontal: spacing.xs },
  bookHeaderText: { fontSize: fontSize.xs, color: colors.text.muted, fontWeight: "600" },
  bookRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: spacing.xs, position: "relative", overflow: "hidden" },
  bookDepthBar: { position: "absolute", top: 0, bottom: 0, borderRadius: 2 },
  askDepthBar: { right: 0, backgroundColor: "rgba(239, 68, 68, 0.06)" },
  bidDepthBar: { right: 0, backgroundColor: "rgba(16, 185, 129, 0.06)" },
  bookPrice: { fontSize: fontSize.sm, fontWeight: "600", fontVariant: ["tabular-nums"] },
  bookQty: { fontSize: fontSize.sm, color: colors.text.secondary, fontVariant: ["tabular-nums"] },
  spreadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginVertical: spacing.xs },
  spreadLeft: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  spreadPrice: { fontSize: fontSize.lg, fontWeight: "800", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  spreadLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  tradeButtons: { flexDirection: "row", paddingHorizontal: spacing.xl, marginTop: spacing.xxl, marginBottom: spacing.xxxl, gap: spacing.sm },
  tradeButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: borderRadius.lg, paddingVertical: spacing.lg },
  buyButton: { backgroundColor: colors.up },
  sellButton: { backgroundColor: colors.down },
  tradeButtonText: { fontSize: fontSize.md, fontWeight: "800", color: colors.white },
});
