import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function DPIAScreen() {
  const { data: dpias = [], isLoading, refetch } = useQuery({
    queryKey: ["dpia-list"],
    queryFn: () => api.getDPIAList(),
    staleTime: 30_000,
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const getRiskColor = (risk: string) => {
    switch (risk) { case "critical": return "#ef4444"; case "high": return "#f59e0b"; case "medium": return "#3b82f6"; default: return "#10b981"; }
  };

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>DPIA Assessments</Text>
      <Text style={s.subtitle}>Data Protection Impact Assessments — NDPA Art. 27</Text>
      {(dpias as any[]).map((d: any) => (
        <View key={d.id} style={s.card}>
          <View style={s.row}>
            <Text style={s.cardTitle}>{d.title ?? `DPIA #${d.id}`}</Text>
            <View style={[s.badge, { backgroundColor: getRiskColor(d.risk_level ?? d.riskLevel ?? "medium") + "20" }]}>
              <Text style={[s.badgeText, { color: getRiskColor(d.risk_level ?? d.riskLevel ?? "medium") }]}>{d.risk_level ?? d.riskLevel ?? "medium"}</Text>
            </View>
          </View>
          <Text style={s.meta}>Status: {d.status ?? "draft"}</Text>
        </View>
      ))}
      {dpias.length === 0 && <Text style={s.empty}>No DPIAs found</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  meta: { color: "#9ca3af", fontSize: 12, marginTop: 8 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
});
