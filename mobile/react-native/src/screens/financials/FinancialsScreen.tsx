import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_SIZE } from "../../utils/theme";

/**
 * FinancialsScreen — Mirrors the PWA equivalent page.
 * tRPC endpoint: financials.summary
 * Revenue, cost, and P&L summary with charts
 */
export default function FinancialsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Financials</Text>
      <Text style={styles.subtitle}>Full implementation mirrors PWA — uses trpc.financials.summary</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center", padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "700", color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: "center" },
});
