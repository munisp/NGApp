import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";
import { useCorporateActions } from "../hooks/useApi";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

const ACTION_TYPE_CONFIG: Record<string, { icon: IconName; color: string }> = {
  STOCK_SPLIT: { icon: "git-branch", color: "#8B5CF6" },
  DIVIDEND: { icon: "dollar-sign", color: "#10B981" },
  SYMBOL_CHANGE: { icon: "tag", color: "#3B82F6" },
  RIGHTS_ISSUE: { icon: "plus-circle", color: "#F59E0B" },
  MERGER: { icon: "git-merge", color: "#EC4899" },
};

export default function CorporateActionsScreen() {
  const { data, loading, refetch } = useCorporateActions();
  const actions = (data as any)?.corporate_actions ?? [];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Corporate Actions</Text>
          <Text style={styles.subtitle}>{actions.length} actions</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
          <Icon name="refresh-cw" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={actions}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: { item: any }) => {
          const config = ACTION_TYPE_CONFIG[item.action_type] || { icon: "file-text" as IconName, color: colors.text.muted };
          const isPending = item.status === "PENDING";
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBg, { backgroundColor: config.color + "18" }]}>
                  <Icon name={config.icon} size={18} color={config.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionType}>{(item.action_type ?? "").replace(/_/g, " ")}</Text>
                  <Text style={styles.symbol}>{item.symbol} | {item.id}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isPending ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)" }]}>
                  <Text style={[styles.statusText, { color: isPending ? colors.warning : colors.up }]}>
                    {item.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.description}>{item.description}</Text>

              <View style={styles.dateRow}>
                <Icon name="calendar" size={12} color={colors.text.muted} />
                <Text style={styles.dateText}>Effective: {item.effective_date}</Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 42, height: 42, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  actionType: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary, textTransform: "capitalize" },
  symbol: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  statusText: { fontSize: fontSize.xs, fontWeight: "700" },
  description: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: spacing.md },
  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  dateText: { fontSize: fontSize.xs, color: colors.text.muted },
});
