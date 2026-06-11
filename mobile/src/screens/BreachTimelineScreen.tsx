import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function BreachTimelineScreen() {
  const { data: breaches = [], isLoading, refetch } = useQuery({
    queryKey: ["breach-timeline"],
    queryFn: () => api.getBreachList(),
    staleTime: 30_000,
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const getSeverityColor = (sev: string) => {
    switch (sev) { case "critical": return "#ef4444"; case "high": return "#f59e0b"; case "medium": return "#3b82f6"; default: return "#10b981"; }
  };

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>Breach Timeline</Text>
      <Text style={s.subtitle}>72-Hour NDPA Notification Tracking</Text>
      {(breaches as any[]).map((b: any) => (
        <View key={b.id} style={[s.card, { borderLeftWidth: 3, borderLeftColor: getSeverityColor(b.severity) }]}>
          <View style={s.row}><Text style={s.cardTitle}>Breach #{b.id}</Text><Text style={[s.badge, { color: getSeverityColor(b.severity) }]}>{b.severity}</Text></View>
          <Text style={s.desc}>{b.description ?? "No description"}</Text>
          <Text style={s.meta}>Status: {b.status} | Subjects: {b.affected_data_subjects ?? "—"}</Text>
          <Text style={s.meta}>Reported: {b.reported_at ? new Date(b.reported_at).toLocaleDateString() : "—"}</Text>
        </View>
      ))}
      {breaches.length === 0 && <Text style={s.empty}>No breaches recorded</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  badge: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  desc: { color: "#d1d5db", fontSize: 13, marginTop: 8 },
  meta: { color: "#9ca3af", fontSize: 12, marginTop: 4 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
});
