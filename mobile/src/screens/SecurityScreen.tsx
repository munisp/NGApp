import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function SecurityScreen() {
  const { data: nocData, isLoading, refetch } = useQuery({
    queryKey: ["security-noc"],
    queryFn: () => api.getNOCStatus(),
    staleTime: 30_000,
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const noc = nocData as any;
  const services = noc?.services ?? [];
  const healthy = services.filter((s: any) => s.status === "healthy").length;

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>Security Overview</Text>
      <Text style={s.subtitle}>Platform Status: {noc?.status ?? "unknown"}</Text>
      <View style={s.stats}>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#10b981" }]}>{healthy}</Text><Text style={s.statLabel}>Healthy</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#ef4444" }]}>{services.length - healthy}</Text><Text style={s.statLabel}>Degraded</Text></View>
        <View style={s.statCard}><Text style={s.statNum}>{services.length}</Text><Text style={s.statLabel}>Total</Text></View>
      </View>
      {services.map((svc: any, i: number) => (
        <View key={i} style={s.card}>
          <View style={s.row}>
            <Text style={s.svcName}>{svc.service_name ?? `Service ${i + 1}`}</Text>
            <View style={[s.dot, { backgroundColor: svc.status === "healthy" ? "#10b981" : "#ef4444" }]} />
          </View>
          <Text style={s.meta}>{svc.response_time_ms ? `${svc.response_time_ms}ms` : "—"}</Text>
        </View>
      ))}
      {services.length === 0 && <Text style={s.empty}>No service data available</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16, textTransform: "capitalize" },
  stats: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: "#111827", borderRadius: 8, padding: 12, alignItems: "center" },
  statNum: { color: "#fff", fontSize: 20, fontWeight: "700" },
  statLabel: { color: "#9ca3af", fontSize: 11 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  svcName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  meta: { color: "#9ca3af", fontSize: 12, marginTop: 4 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
});
