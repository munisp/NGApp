import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function WorkflowsScreen() {
  const { data: workflows = [], isLoading, refetch } = useQuery({
    queryKey: ["active-workflows"],
    queryFn: () => api.getActiveWorkflows(),
    staleTime: 30_000,
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const getStatusColor = (s: string) => { switch (s) { case "running": return "#3b82f6"; case "completed": return "#10b981"; case "failed": return "#ef4444"; default: return "#f59e0b"; } };

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>Active Workflows</Text>
      <Text style={s.subtitle}>Temporal Workflow Orchestration</Text>
      {(workflows as any[]).map((w: any) => (
        <View key={w.id} style={s.card}>
          <View style={s.row}><Text style={s.cardTitle}>{w.workflow_type ?? w.workflowType ?? "Workflow"}</Text><Text style={[s.status, { color: getStatusColor(w.status) }]}>{w.status}</Text></View>
          <Text style={s.meta}>Entity: {w.entity_id ?? w.entityId ?? "—"}</Text>
        </View>
      ))}
      {workflows.length === 0 && <Text style={s.empty}>No active workflows</Text>}
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
  status: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  meta: { color: "#9ca3af", fontSize: 12, marginTop: 8 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
});
