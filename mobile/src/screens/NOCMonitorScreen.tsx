import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function NOCMonitorScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data: noc, refetch } = useQuery({
    queryKey: ["noc-status"],
    queryFn: () => api.getNOCStatus(),
    staleTime: 10_000,
  });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const services = noc?.services ?? [];
  const statusIcon = (s: string) => s === "healthy" ? "🟢" : s === "degraded" ? "🟡" : "🔴";

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}>
      <View style={s.header}>
        <Text style={s.title}>NOC Monitor</Text>
        <Text style={s.subtitle}>Network Operations Center — Real-time</Text>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Platform Status</Text>
        <Text style={[s.overallStatus, { color: noc?.overall === "healthy" ? "#10b981" : "#f59e0b" }]}>
          {noc?.overall === "healthy" ? "All Systems Operational" : "Degraded Performance"}
        </Text>
      </View>
      {services.map((svc: { name: string; status: string; latency_ms: number; uptime: number }, idx: number) => (
        <View key={idx} style={s.card}>
          <View style={s.svcRow}>
            <Text style={s.svcStatus}>{statusIcon(svc.status)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.svcName}>{svc.name}</Text>
              <Text style={s.svcMeta}>{svc.latency_ms}ms • {(svc.uptime * 100).toFixed(2)}% uptime</Text>
            </View>
          </View>
        </View>
      ))}
      {services.length === 0 && <View style={s.card}><Text style={s.emptyText}>Connecting to NOC…</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginTop: 4 },
  card: { backgroundColor: "#111827", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  cardTitle: { color: "#d1d5db", fontSize: 14, fontWeight: "600" },
  overallStatus: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  svcRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  svcStatus: { fontSize: 16 },
  svcName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  svcMeta: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  emptyText: { color: "#6b7280", textAlign: "center" },
});
