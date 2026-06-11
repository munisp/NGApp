import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function DataTransfersScreen() {
  const { data: transfers = [], isLoading, refetch } = useQuery({
    queryKey: ["data-transfers"],
    queryFn: () => api.getDataTransfers(),
    staleTime: 30_000,
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const getStatusColor = (s: string) => { switch (s) { case "approved": return "#10b981"; case "pending": return "#f59e0b"; case "rejected": return "#ef4444"; default: return "#6b7280"; } };

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>Cross-Border Transfers</Text>
      <Text style={s.subtitle}>NDPA Art. 44 — International Data Transfers</Text>
      {(transfers as any[]).map((t: any) => (
        <View key={t.id} style={s.card}>
          <Text style={s.route}>{t.source_country ?? t.sourceCountry ?? "NG"} → {t.destination_country ?? t.destinationCountry ?? "—"}</Text>
          <Text style={s.mechanism}>{t.transfer_mechanism ?? t.transferMechanism ?? "Adequacy"}</Text>
          <Text style={[s.status, { color: getStatusColor(t.status) }]}>{t.status}</Text>
        </View>
      ))}
      {transfers.length === 0 && <Text style={s.empty}>No cross-border transfers</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 12 },
  route: { color: "#fff", fontSize: 18, fontWeight: "700" },
  mechanism: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  status: { fontSize: 13, fontWeight: "600", marginTop: 8, textTransform: "capitalize" },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
});
