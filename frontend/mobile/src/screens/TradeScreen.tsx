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
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";
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
        </View>

        {/* Symbol Banner */}
        <View style={styles.symbolBanner}>
          <View>
            <Text style={styles.symbolText}>🌾 {symbol}</Text>
            <Text style={styles.symbolName}>Maize (Corn)</Text>
          </View>
          <View style={styles.priceBox}>
            <Text style={styles.currentPrice}>${currentPrice.toFixed(2)}</Text>
            <Text style={[styles.change, { color: colors.up }]}>+1.15%</Text>
          </View>
        </View>

        {/* Buy/Sell Toggle */}
        <View style={styles.sideToggle}>
          <TouchableOpacity
            style={[styles.sideButton, side === "BUY" && styles.buyActive]}
            onPress={() => setSide("BUY")}
          >
            <Text style={[styles.sideText, side === "BUY" && styles.sideTextActive]}>Buy / Long</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sideButton, side === "SELL" && styles.sellActive]}
            onPress={() => setSide("SELL")}
          >
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
              >
                <Text style={styles.stepText}>−</Text>
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
              >
                <Text style={styles.stepText}>+</Text>
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
                style={styles.presetButton}
                onPress={() => setQuantity(String(q))}
              >
                <Text style={styles.presetText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Estimated Total</Text>
            <Text style={styles.summaryValue}>${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Est. Margin</Text>
            <Text style={styles.summaryValue}>${(total * 0.1).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Est. Fee</Text>
            <Text style={styles.summaryValue}>${(total * 0.001).toFixed(2)}</Text>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, side === "BUY" ? styles.submitBuy : styles.submitSell]}
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>
            {side === "BUY" ? "Buy" : "Sell"} {symbol}
          </Text>
        </TouchableOpacity>

        {/* Available Balance */}
        <Text style={styles.balanceText}>
          Available Balance: $98,540.20
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  symbolBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  symbolText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  symbolName: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  priceBox: { alignItems: "flex-end" },
  currentPrice: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  change: { fontSize: fontSize.sm, fontWeight: "600", marginTop: 2 },
  sideToggle: { flexDirection: "row", marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  sideButton: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm, alignItems: "center" },
  buyActive: { backgroundColor: colors.up },
  sellActive: { backgroundColor: colors.down },
  sideText: { fontSize: fontSize.md, fontWeight: "600", color: colors.text.muted },
  sideTextActive: { color: colors.white },
  orderTypes: { flexDirection: "row", marginHorizontal: spacing.xl, marginTop: spacing.lg, gap: spacing.sm },
  orderTypeButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, alignItems: "center", backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border },
  orderTypeActive: { backgroundColor: colors.bg.tertiary, borderColor: colors.text.muted },
  orderTypeText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.muted },
  orderTypeTextActive: { color: colors.text.primary },
  inputGroup: { marginHorizontal: spacing.xl, marginTop: spacing.xl },
  inputLabel: { fontSize: fontSize.xs, color: colors.text.muted, textTransform: "uppercase", marginBottom: spacing.sm },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepButton: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 20, color: colors.text.primary },
  priceInput: { flex: 1, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary, textAlign: "center", fontVariant: ["tabular-nums"] },
  quantityInput: { height: 48, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  quantityPresets: { flexDirection: "row", marginTop: spacing.sm, gap: spacing.sm },
  presetButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  presetText: { fontSize: fontSize.sm, color: colors.text.muted, fontWeight: "600" },
  summary: { marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  summaryLabel: { fontSize: fontSize.sm, color: colors.text.muted },
  summaryValue: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  submitButton: { marginHorizontal: spacing.xl, marginTop: spacing.xl, borderRadius: borderRadius.md, paddingVertical: spacing.lg, alignItems: "center" },
  submitBuy: { backgroundColor: colors.up },
  submitSell: { backgroundColor: colors.down },
  submitText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.white },
  balanceText: { textAlign: "center", fontSize: fontSize.xs, color: colors.text.muted, marginTop: spacing.lg, marginBottom: spacing.xxxl },
});
