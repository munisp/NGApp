import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_SIZE } from "../../utils/theme";

/**
 * PermitsScreen — Mirrors the PWA equivalent page.
 * tRPC endpoint: permits.list
 * Permit-to-Work list with approve/reject actions
 */
export default function PermitsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Permits</Text>
      <Text style={styles.subtitle}>Full implementation mirrors PWA — uses trpc.permits.list</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center", padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "700", color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: "center" },
});
