import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, FlatList } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function OrganizationDetailScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["compliance-overview"],
    queryFn: () => api.getComplianceOverview(),
    staleTime: 30_000,
  });

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const orgs = data?.organizations ?? [];

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}>
      <View style={s.header}>
        <Text style={s.title}>Organizations</Text>
        <Text style={s.subtitle}>{orgs.length} registered data controllers</Text>
      </View>
      {orgs.length === 0 ? (
        <View style={s.card}><Text style={s.emptyText}>No organizations loaded</Text></View>
      ) : (
        orgs.map((org: { id: number; name: string; sector: string; compliance_score?: number }, idx: number) => (
          <View key={idx} style={s.card}>
            <Text style={s.orgName}>{org.name}</Text>
            <Text style={s.orgSector}>{org.sector}</Text>
            <Text style={[s.orgScore, { color: (org.compliance_score ?? 0) >= 80 ? "#10b981" : "#f59e0b" }]}>
              Score: {org.compliance_score ?? "N/A"}%
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginTop: 4 },
  card: { backgroundColor: "#111827", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  emptyText: { color: "#6b7280", textAlign: "center", fontSize: 14 },
  orgName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  orgSector: { color: "#9ca3af", fontSize: 13, marginTop: 2 },
  orgScore: { fontSize: 14, fontWeight: "700", marginTop: 6 },
});
