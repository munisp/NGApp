import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function NetworkIntelligenceScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data: metrics, refetch } = useQuery({
    queryKey: ["platform-metrics"],
    queryFn: () => api.getPlatformMetrics(),
    staleTime: 60_000,
  });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const netMetrics = [
    { label: "Ingress Traffic", value: metrics?.ingress_mbps ?? "—", unit: "Mbps" },
    { label: "Active Connections", value: metrics?.active_connections ?? "—", unit: "" },
    { label: "Blocked IPs (24h)", value: metrics?.blocked_ips_24h ?? "—", unit: "" },
    { label: "WAF Events (24h)", value: metrics?.waf_events_24h ?? "—", unit: "" },
    { label: "DNS Queries/s", value: metrics?.dns_qps ?? "—", unit: "/s" },
    { label: "SSL Certificate Expiry", value: metrics?.ssl_days_remaining ?? "—", unit: "days" },
  ];

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <View style={s.header}><Text style={s.title}>Network Intelligence</Text><Text style={s.subtitle}>Real-time network & threat monitoring</Text></View>
      {netMetrics.map((m, idx) => (
        <View key={idx} style={s.card}>
          <Text style={s.metricLabel}>{m.label}</Text>
          <Text style={s.metricValue}>{m.value}{m.unit ? ` ${m.unit}` : ""}</Text>
        </View>
      ))}
      <View style={s.card}>
        <Text style={s.cardTitle}>Threat Map</Text>
        <Text style={s.placeholder}>Geographic threat visualization requires full-screen mode</Text>
      </View>
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
  metricLabel: { color: "#6b7280", fontSize: 12 },
  metricValue: { color: "#3b82f6", fontSize: 28, fontWeight: "800", marginTop: 4 },
  placeholder: { color: "#4b5563", fontSize: 13, marginTop: 8, textAlign: "center" },
});
