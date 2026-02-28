import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius, shadows } from "../styles/theme";
import Icon from "../components/Icon";
import type { OrderSide, OrderType } from "../types";

export default function TradeScreen() {
  const [symbol] = useState("MAIZE");
  const [side, setSide] = useState<OrderSide>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [price, setPrice] = useState("285.50");
  const [quantity, setQuantity] = useState("");

  const currentPrice = 285.5;
  const total = Number(price) * Number(quantity) || 0;

  const handleSubmit = () => {
    if (!quantity) {
      Alert.alert("Error", "Please enter a quantity");
      return;
    }
    Alert.alert(
      "Confirm Order",
      `${side} ${quantity} lots of ${symbol} at $${price}\nTotal: $${total.toLocaleString()}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => Alert.alert("Success", "Order submitted successfully") },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Quick Trade</Text>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="clock" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Symbol Banner */}
        <View style={styles.symbolBanner}>
          <View style={styles.symbolLeft}>
            <View style={styles.symbolIconBg}>
              <Icon name="wheat" size={20} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.symbolText}>{symbol}</Text>
              <Text style={styles.symbolName}>Maize (Corn)</Text>
            </View>
          </View>
          <View style={styles.priceBox}>
            <Text style={styles.currentPrice}>${currentPrice.toFixed(2)}</Text>
            <View style={styles.changeBadge}>
              <Icon name="trending-up" size={10} color={colors.up} />
              <Text style={[styles.change, { color: colors.up }]}>+1.15%</Text>
            </View>
          </View>
        </View>

        {/* Buy/Sell Toggle */}
        <View style={styles.sideToggle}>
          <TouchableOpacity
            style={[styles.sideButton, side === "BUY" && styles.buyActive]}
            onPress={() => setSide("BUY")}
            activeOpacity={0.8}
          >
            <Icon name="trending-up" size={16} color={side === "BUY" ? colors.white : colors.text.muted} />
            <Text style={[styles.sideText, side === "BUY" && styles.sideTextActive]}>Buy / Long</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sideButton, side === "SELL" && styles.sellActive]}
            onPress={() => setSide("SELL")}
            activeOpacity={0.8}
          >
            <Icon name="trending-down" size={16} color={side === "SELL" ? colors.white : colors.text.muted} />
            <Text style={[styles.sideText, side === "SELL" && styles.sideTextActive]}>Sell / Short</Text>
          </TouchableOpacity>
        </View>

        {/* Order Type */}
        <View style={styles.orderTypes}>
          {(["MARKET", "LIMIT", "STOP"] as OrderType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.orderTypeButton, orderType === t && styles.orderTypeActive]}
              onPress={() => setOrderType(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.orderTypeText, orderType === t && styles.orderTypeTextActive]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price Input */}
        {orderType !== "MARKET" && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Price</Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setPrice((Number(price) - 0.25).toFixed(2))}
                activeOpacity={0.7}
              >
                <Icon name="minus" size={18} color={colors.text.primary} />
              </TouchableOpacity>
              <TextInput
                style={styles.priceInput}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setPrice((Number(price) + 0.25).toFixed(2))}
                activeOpacity={0.7}
              >
                <Icon name="plus" size={18} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quantity Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Quantity (lots)</Text>
          <TextInput
            style={styles.quantityInput}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.text.muted}
          />
          <View style={styles.quantityPresets}>
            {[10, 25, 50, 100].map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.presetButton, quantity === String(q) && styles.presetActive]}
                onPress={() => setQuantity(String(q))}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetText, quantity === String(q) && styles.presetTextActive]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLabelRow}>
              <Icon name="dollar" size={12} color={colors.text.muted} />
              <Text style={styles.summaryLabel}>Estimated Total</Text>
            </View>
            <Text style={styles.summaryValue}>${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryLabelRow}>
              <Icon name="shield" size={12} color={colors.text.muted} />
              <Text style={styles.summaryLabel}>Est. Margin</Text>
            </View>
            <Text style={styles.summaryValue}>${(total * 0.1).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryLabelRow}>
              <Icon name="receipt" size={12} color={colors.text.muted} />
              <Text style={styles.summaryLabel}>Est. Fee</Text>
            </View>
            <Text style={styles.summaryValue}>${(total * 0.001).toFixed(2)}</Text>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, side === "BUY" ? styles.submitBuy : styles.submitSell]}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Icon name={side === "BUY" ? "trending-up" : "trending-down"} size={20} color={colors.white} />
          <Text style={styles.submitText}>
            {side === "BUY" ? "Buy" : "Sell"} {symbol}
          </Text>
        </TouchableOpacity>

        {/* Available Balance */}
        <View style={styles.balanceRow}>
          <Icon name="wallet" size={12} color={colors.text.muted} />
          <Text style={styles.balanceText}>Available Balance: $98,540.20</Text>
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
  symbolBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  symbolLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  symbolIconBg: { width: 42, height: 42, borderRadius: borderRadius.md, backgroundColor: "rgba(245, 158, 11, 0.12)", alignItems: "center", justifyContent: "center" },
  symbolText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  symbolName: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  priceBox: { alignItems: "flex-end" },
  currentPrice: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  changeBadge: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  change: { fontSize: fontSize.sm, fontWeight: "700" },
  sideToggle: { flexDirection: "row", marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: 4, borderWidth: 1, borderColor: colors.border },
  sideButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  buyActive: { backgroundColor: colors.up, ...shadows.glow },
  sellActive: { backgroundColor: colors.down },
  sideText: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.muted },
  sideTextActive: { color: colors.white },
  orderTypes: { flexDirection: "row", marginHorizontal: spacing.xl, marginTop: spacing.lg, gap: spacing.sm },
  orderTypeButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: "center", backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border },
  orderTypeActive: { backgroundColor: colors.bg.tertiary, borderColor: colors.borderLight },
  orderTypeText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.muted },
  orderTypeTextActive: { color: colors.text.primary },
  inputGroup: { marginHorizontal: spacing.xl, marginTop: spacing.xl },
  inputLabel: { fontSize: fontSize.xs, color: colors.text.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm, fontWeight: "600" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepButton: { width: 46, height: 46, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  priceInput: { flex: 1, height: 46, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, textAlign: "center", fontVariant: ["tabular-nums"] },
  quantityInput: { height: 50, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  quantityPresets: { flexDirection: "row", marginTop: spacing.sm, gap: spacing.sm },
  presetButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  presetActive: { backgroundColor: colors.brand.subtle, borderColor: colors.brand.primary },
  presetText: { fontSize: fontSize.sm, color: colors.text.muted, fontWeight: "700" },
  presetTextActive: { color: colors.brand.primary },
  summary: { marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  summaryLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  summaryLabel: { fontSize: fontSize.sm, color: colors.text.muted },
  summaryValue: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  summaryDivider: { height: 1, backgroundColor: colors.border },
  submitButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: spacing.xl, borderRadius: borderRadius.lg, paddingVertical: spacing.lg },
  submitBuy: { backgroundColor: colors.up },
  submitSell: { backgroundColor: colors.down },
  submitText: { fontSize: fontSize.lg, fontWeight: "800", color: colors.white },
  balanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.xxxl },
  balanceText: { fontSize: fontSize.xs, color: colors.text.muted },
});
