import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function NotificationsScreen() {
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getActiveAlerts(),
    staleTime: 15_000,
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const getSeverityColor = (sev: string) => { switch (sev) { case "critical": return "#ef4444"; case "high": return "#f59e0b"; case "medium": return "#3b82f6"; default: return "#10b981"; } };

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>Notifications</Text>
      <Text style={s.subtitle}>{alerts.length} active alert{alerts.length !== 1 ? "s" : ""}</Text>
      {(alerts as any[]).map((a: any) => (
        <View key={a.id} style={[s.card, { borderLeftWidth: 3, borderLeftColor: getSeverityColor(a.severity) }]}>
          <Text style={s.cardTitle}>{a.title ?? `Alert #${a.id}`}</Text>
          <Text style={s.meta}>{a.type ?? "system"} | {a.timestamp ? new Date(a.timestamp).toLocaleString() : "—"}</Text>
        </View>
      ))}
      {alerts.length === 0 && <Text style={s.empty}>No notifications</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 12 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  meta: { color: "#9ca3af", fontSize: 12, marginTop: 8 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
});
