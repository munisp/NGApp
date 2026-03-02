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
import { useBrokers } from "../hooks/useApi";
import Icon from "../components/Icon";

const ROUTING_COLORS: Record<string, string> = {
  DMA: "#10B981",
  SOR: "#3B82F6",
  ALGO: "#8B5CF6",
};

export default function BrokersScreen() {
  const { data, loading, refetch } = useBrokers();
  const brokers = (data as any)?.brokers ?? [];
  const connected = brokers.filter((b: any) => b.status === "CONNECTED").length;

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
          <Text style={styles.title}>Brokers</Text>
          <Text style={styles.subtitle}>{connected}/{brokers.length} connected</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
          <Icon name="refresh-cw" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={brokers}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: { item: any }) => {
          const isConnected = item.status === "CONNECTED";
          const routingColor = ROUTING_COLORS[item.order_routing] || colors.text.muted;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBg, { backgroundColor: isConnected ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }]}>
                  <Icon name="radio" size={18} color={isConnected ? colors.up : colors.down} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.brokerName}>{item.name}</Text>
                  <Text style={styles.brokerId}>{item.id}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isConnected ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }]}>
                  <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.up : colors.down }]} />
                  <Text style={[styles.statusText, { color: isConnected ? colors.up : colors.down }]}>
                    {item.status}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Clients</Text>
                  <Text style={styles.statValue}>{item.connected_clients ?? 0}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Routing</Text>
                  <View style={[styles.routingBadge, { backgroundColor: routingColor + "18" }]}>
                    <Text style={[styles.routingText, { color: routingColor }]}>{item.order_routing}</Text>
                  </View>
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
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 42, height: 42, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  brokerName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  brokerId: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: fontSize.xs, fontWeight: "700" },
  cardBottom: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  stat: { alignItems: "center" },
  statLabel: { fontSize: fontSize.xs, color: colors.text.muted, marginBottom: 4 },
  statValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  routingBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.xs },
  routingText: { fontSize: fontSize.sm, fontWeight: "700" },
});
