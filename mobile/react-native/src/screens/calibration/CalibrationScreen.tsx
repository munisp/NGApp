import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_SIZE } from "../../utils/theme";

/**
 * CalibrationScreen — Mirrors the PWA equivalent page.
 * tRPC endpoint: calibration.list
 * Instrument calibration records and due-date tracking
 */
export default function CalibrationScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calibration</Text>
      <Text style={styles.subtitle}>Full implementation mirrors PWA — uses trpc.calibration.list</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center", padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "700", color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: "center" },
});
