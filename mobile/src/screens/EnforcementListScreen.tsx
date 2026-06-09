import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function EnforcementListScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["enforcement-cases"],
    queryFn: () => api.getEnforcementCases(),
    staleTime: 30_000,
  });

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  const cases = data?.cases ?? [];

  const statusColor = (s: string) => s === "open" ? "#ef4444" : s === "investigating" ? "#f59e0b" : s === "resolved" ? "#10b981" : "#6b7280";

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}>
      <View style={s.header}>
        <Text style={s.title}>Enforcement Cases</Text>
        <Text style={s.subtitle}>{cases.length} active cases</Text>
      </View>
      {cases.map((c: { id: string; org_name: string; case_type: string; status: string; severity: string; created_at: string }, idx: number) => (
        <View key={idx} style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.caseName}>{c.org_name}</Text>
            <View style={[s.badge, { backgroundColor: statusColor(c.status) + "22" }]}>
              <Text style={[s.badgeText, { color: statusColor(c.status) }]}>{c.status}</Text>
            </View>
          </View>
          <Text style={s.caseType}>{c.case_type} — Severity: {c.severity}</Text>
          <Text style={s.caseDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
        </View>
      ))}
      {cases.length === 0 && <View style={s.card}><Text style={s.emptyText}>No enforcement cases</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginTop: 4 },
  card: { backgroundColor: "#111827", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  caseName: { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  caseType: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  caseDate: { color: "#6b7280", fontSize: 12, marginTop: 4 },
  emptyText: { color: "#6b7280", textAlign: "center", fontSize: 14 },
});
