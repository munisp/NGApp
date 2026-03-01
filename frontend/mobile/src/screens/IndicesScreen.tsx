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
import { useIndices } from "../hooks/useApi";
import Icon from "../components/Icon";

export default function IndicesScreen() {
  const { data, loading, refetch } = useIndices();
  const indices = (data as any)?.indices ?? [];

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
          <Text style={styles.title}>Indices</Text>
          <Text style={styles.subtitle}>{indices.length} indices tracked</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
          <Icon name="refresh-cw" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={indices}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: { item: any }) => {
          const isUp = (item.change_pct ?? 0) >= 0;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.iconBg, { backgroundColor: isUp ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }]}>
                  <Icon name={isUp ? "trending-up" : "trending-down"} size={18} color={isUp ? colors.up : colors.down} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.indexName}>{item.name}</Text>
                  <Text style={styles.indexId}>{item.id}</Text>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Value</Text>
                  <Text style={styles.statValue}>{(item.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Change</Text>
                  <Text style={[styles.statValue, { color: isUp ? colors.up : colors.down }]}>
                    {isUp ? "+" : ""}{(item.change_pct ?? 0).toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Components</Text>
                  <Text style={styles.statValue}>{item.components ?? 0}</Text>
                </View>
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
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 42, height: 42, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  indexName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  indexId: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  stat: { alignItems: "center" },
  statLabel: { fontSize: fontSize.xs, color: colors.text.muted, marginBottom: 2 },
  statValue: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary, fontVariant: ["tabular-nums"] },
});
