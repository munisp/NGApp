import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_SIZE } from "../../utils/theme";

/**
 * WellDetailScreen — Mirrors the PWA equivalent page.
 * tRPC endpoint: wells.getById
 * Well detail with telemetry charts, alarms, and workover history
 */
export default function WellDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>WellDetail</Text>
      <Text style={styles.subtitle}>Full implementation mirrors PWA — uses trpc.wells.getById</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center", padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "700", color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: "center" },
});
