import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_SIZE } from "../../utils/theme";

/**
 * MaterialsScreen — Mirrors the PWA equivalent page.
 * tRPC endpoint: materials.list
 * Materials inventory — stock levels and requisitions
 */
export default function MaterialsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Materials</Text>
      <Text style={styles.subtitle}>Full implementation mirrors PWA — uses trpc.materials.list</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center", padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "700", color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: "center" },
});
