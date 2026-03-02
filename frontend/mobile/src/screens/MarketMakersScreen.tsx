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
import { useMarketMakers } from "../hooks/useApi";
import Icon from "../components/Icon";

export default function MarketMakersScreen() {
  const { data, loading, refetch } = useMarketMakers();
  const makers = (data as any)?.market_makers ?? [];

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
          <Text style={styles.title}>Market Makers</Text>
          <Text style={styles.subtitle}>{makers.length} registered</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
          <Icon name="refresh-cw" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={makers}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: { item: any }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBg, { backgroundColor: colors.brand.subtle }]}>
                <Icon name="users" size={18} color={colors.brand.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.makerName}>{item.name}</Text>
                <Text style={styles.makerId}>{item.id} | {item.clearing_member_id}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: item.status === "ACTIVE" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }]}>
                <View style={[styles.statusDot, { backgroundColor: item.status === "ACTIVE" ? colors.up : colors.down }]} />
                <Text style={[styles.statusText, { color: item.status === "ACTIVE" ? colors.up : colors.down }]}>
                  {item.status}
                </Text>
              </View>
            </View>

            {item.assigned_symbols && (
              <View style={styles.symbolsRow}>
                <Text style={styles.symbolsLabel}>Symbols:</Text>
                <View style={styles.symbolTags}>
                  {item.assigned_symbols.slice(0, 6).map((sym: string) => (
                    <View key={sym} style={styles.symbolTag}>
                      <Text style={styles.symbolTagText}>{sym}</Text>
                    </View>
                  ))}
                  {item.assigned_symbols.length > 6 && (
                    <Text style={styles.moreText}>+{item.assigned_symbols.length - 6}</Text>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
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
  makerName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  makerId: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: fontSize.xs, fontWeight: "700" },
  symbolsRow: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  symbolsLabel: { fontSize: fontSize.xs, color: colors.text.muted, marginBottom: spacing.xs },
  symbolTags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  symbolTag: { backgroundColor: colors.bg.tertiary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.xs },
  symbolTagText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text.secondary },
  moreText: { fontSize: fontSize.xs, color: colors.text.muted, alignSelf: "center" },
});
