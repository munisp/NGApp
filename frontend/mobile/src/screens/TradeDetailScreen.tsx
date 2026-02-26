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
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "TradeDetail">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const commodityData: Record<string, {
  name: string;
  icon: string;
  price: number;
  change: number;
  high: number;
  low: number;
  volume: string;
  unit: string;
}> = {
  MAIZE: { name: "Maize (Corn)", icon: "🌾", price: 285.50, change: 1.15, high: 287.00, low: 281.00, volume: "45.2K", unit: "MT" },
  GOLD: { name: "Gold", icon: "🥇", price: 2345.60, change: 0.53, high: 2352.00, low: 2330.00, volume: "89.2K", unit: "OZ" },
  COFFEE: { name: "Coffee Arabica", icon: "☕", price: 4520.00, change: 1.01, high: 4535.00, low: 4470.00, volume: "18.9K", unit: "MT" },
  CRUDE_OIL: { name: "Crude Oil (WTI)", icon: "🛢", price: 78.42, change: 1.59, high: 79.10, low: 76.80, volume: "125.8K", unit: "BBL" },
  CARBON: { name: "Carbon Credits", icon: "🌿", price: 65.20, change: 1.32, high: 65.80, low: 64.10, volume: "15.6K", unit: "TCO2" },
};

export default function TradeDetailScreen({ route }: Props) {
  const { symbol } = route.params;
  const data = commodityData[symbol] ?? commodityData.MAIZE;
  const [timeframe, setTimeframe] = useState("1H");

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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Symbol Header */}
      <View style={styles.symbolHeader}>
        <View style={styles.symbolLeft}>
          <Text style={styles.symbolIcon}>{data.icon}</Text>
          <View>
            <Text style={styles.symbolText}>{symbol}</Text>
            <Text style={styles.symbolName}>{data.name}</Text>
          </View>
        </View>
        <View style={styles.symbolRight}>
          <Text style={styles.price}>${data.price.toLocaleString()}</Text>
          <Text style={[styles.change, { color: data.change >= 0 ? colors.up : colors.down }]}>
            {data.change >= 0 ? "+" : ""}{data.change.toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>24h High</Text>
          <Text style={styles.statValue}>${data.high.toLocaleString()}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>24h Low</Text>
          <Text style={styles.statValue}>${data.low.toLocaleString()}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Volume</Text>
          <Text style={styles.statValue}>{data.volume} {data.unit}</Text>
        </View>
      </View>

      {/* Chart Placeholder */}
      <View style={styles.chartContainer}>
        {/* Timeframe selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeframes}>
          {timeframes.map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[styles.tfButton, timeframe === tf && styles.tfActive]}
              onPress={() => setTimeframe(tf)}
            >
              <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>{tf}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Canvas-style chart placeholder */}
        <View style={styles.chart}>
          <View style={styles.chartLine} />
          <Text style={styles.chartPlaceholder}>Interactive Chart</Text>
          <Text style={styles.chartSubtext}>Candlestick / Line chart renders here</Text>
        </View>
      </View>

      {/* Order Book */}
      <View style={styles.orderBookContainer}>
        <Text style={styles.sectionTitle}>Order Book</Text>
        <View style={styles.orderBook}>
          {/* Asks */}
          <View style={styles.bookSide}>
            <View style={styles.bookHeader}>
              <Text style={styles.bookHeaderText}>Price</Text>
              <Text style={styles.bookHeaderText}>Qty</Text>
            </View>
            {asks.reverse().map((ask, i) => (
              <View key={`ask-${i}`} style={styles.bookRow}>
                <Text style={[styles.bookPrice, { color: colors.down }]}>{ask.price}</Text>
                <Text style={styles.bookQty}>{ask.qty}</Text>
              </View>
            ))}
          </View>

          {/* Spread */}
          <View style={styles.spreadRow}>
            <Text style={styles.spreadPrice}>${data.price.toFixed(2)}</Text>
            <Text style={styles.spreadLabel}>Spread: {(data.price * 0.002).toFixed(2)}</Text>
          </View>

          {/* Bids */}
          <View style={styles.bookSide}>
            {bids.map((bid, i) => (
              <View key={`bid-${i}`} style={styles.bookRow}>
                <Text style={[styles.bookPrice, { color: colors.up }]}>{bid.price}</Text>
                <Text style={styles.bookQty}>{bid.qty}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Trade Buttons */}
      <View style={styles.tradeButtons}>
        <TouchableOpacity style={[styles.tradeButton, styles.buyButton]}>
          <Text style={styles.tradeButtonText}>Buy / Long</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tradeButton, styles.sellButton]}>
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
  symbolIcon: { fontSize: 32 },
  symbolText: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary },
  symbolName: { fontSize: fontSize.sm, color: colors.text.muted },
  symbolRight: { alignItems: "flex-end" },
  price: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  change: { fontSize: fontSize.sm, fontWeight: "600" },
  statsRow: { flexDirection: "row", paddingHorizontal: spacing.xl, gap: spacing.sm },
  statItem: { flex: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  statValue: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.primary, marginTop: 2, fontVariant: ["tabular-nums"] },
  chartContainer: { marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  timeframes: { marginBottom: spacing.sm },
  tfButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.xs },
  tfActive: { backgroundColor: colors.bg.tertiary },
  tfText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text.muted },
  tfTextActive: { color: colors.text.primary },
  chart: { height: 250, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chartLine: { position: "absolute", left: 0, right: 0, top: "50%", height: 1, backgroundColor: colors.brand.primary, opacity: 0.3 },
  chartPlaceholder: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.muted },
  chartSubtext: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 4 },
  orderBookContainer: { marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, marginBottom: spacing.md },
  orderBook: { backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  bookSide: {},
  bookHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  bookHeaderText: { fontSize: fontSize.xs, color: colors.text.muted },
  bookRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  bookPrice: { fontSize: fontSize.sm, fontWeight: "500", fontVariant: ["tabular-nums"] },
  bookQty: { fontSize: fontSize.sm, color: colors.text.secondary, fontVariant: ["tabular-nums"] },
  spreadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginVertical: spacing.xs },
  spreadPrice: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  spreadLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  tradeButtons: { flexDirection: "row", paddingHorizontal: spacing.xl, marginTop: spacing.xxl, marginBottom: spacing.xxxl, gap: spacing.sm },
  tradeButton: { flex: 1, borderRadius: borderRadius.md, paddingVertical: spacing.lg, alignItems: "center" },
  buyButton: { backgroundColor: colors.up },
  sellButton: { backgroundColor: colors.down },
  tradeButtonText: { fontSize: fontSize.md, fontWeight: "700", color: colors.white },
});
