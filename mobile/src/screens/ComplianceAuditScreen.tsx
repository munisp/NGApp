import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function ComplianceAuditScreen() {
  const { data: audits = [], isLoading, refetch } = useQuery({
    queryKey: ["compliance-audits"],
    queryFn: () => api.getComplianceAudits(),
    staleTime: 30_000,
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const getScoreColor = (score: number) => score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>Compliance Audits</Text>
      <Text style={s.subtitle}>CAR Submissions & Audit Returns</Text>
      {(audits as any[]).map((a: any) => (
        <View key={a.id} style={s.card}>
          <View style={s.row}><Text style={s.cardTitle}>Audit #{a.id}</Text><Text style={[s.score, { color: getScoreColor(a.score ?? 0) }]}>{a.score ?? "—"}%</Text></View>
          <Text style={s.meta}>Status: {a.status ?? "pending"} | Org: #{a.org_id ?? a.orgId ?? "—"}</Text>
        </View>
      ))}
      {audits.length === 0 && <Text style={s.empty}>No audits found</Text>}
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
  score: { fontSize: 20, fontWeight: "700" },
  meta: { color: "#9ca3af", fontSize: 12, marginTop: 8 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
});
