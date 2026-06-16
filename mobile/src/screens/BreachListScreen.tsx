import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function BreachListScreen({ navigation }: { navigation: { navigate: (screen: string) => void } }) {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["active-alerts"],
    queryFn: () => api.getActiveAlerts(),
    staleTime: 10_000,
  });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  const breaches = (data?.alerts ?? []).filter((a: { type: string }) => a.type === "breach" || a.type === "incident");

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />}>
      <View style={s.header}>
        <Text style={s.title}>Breach Incidents</Text>
        <TouchableOpacity style={s.reportBtn} onPress={() => navigation.navigate("BreachReport")}>
          <Text style={s.reportText}>+ Report Breach</Text>
        </TouchableOpacity>
      </View>
      {breaches.length === 0 && <View style={s.card}><Text style={s.emptyText}>No active breach incidents</Text></View>}
      {breaches.map((b: { id: string; title: string; severity: string; reported_at: string; status: string }, idx: number) => (
        <View key={idx} style={s.card}>
          <Text style={s.breachTitle}>{b.title}</Text>
          <View style={s.row}>
            <View style={[s.badge, { backgroundColor: b.severity === "critical" ? "#7f1d1d" : "#78350f" }]}>
              <Text style={s.badgeText}>{b.severity}</Text>
            </View>
            <Text style={s.date}>{new Date(b.reported_at).toLocaleDateString()}</Text>
          </View>
          <Text style={s.status}>Status: {b.status}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  reportBtn: { backgroundColor: "#dc2626", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  reportText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  card: { backgroundColor: "#111827", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  emptyText: { color: "#6b7280", textAlign: "center" },
  breachTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#fbbf24", fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  date: { color: "#6b7280", fontSize: 12 },
  status: { color: "#9ca3af", fontSize: 13, marginTop: 6 },
});
