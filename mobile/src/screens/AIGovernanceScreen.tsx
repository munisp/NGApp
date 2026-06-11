import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

interface AISystem {
  id: number;
  model_name?: string;
  modelName?: string;
  risk_level?: string;
  riskLevel?: string;
  compliance_status?: string;
  complianceStatus?: string;
  last_audit_date?: string;
}

export function AIGovernanceScreen() {
  const { data: systems = [], isLoading, refetch } = useQuery({
    queryKey: ["ai-models"],
    queryFn: () => api.getAIModels(),
    staleTime: 30_000,
  });
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const items = systems.map((s: AISystem) => ({
    id: s.id,
    name: s.model_name ?? s.modelName ?? `Model #${s.id}`,
    riskLevel: s.risk_level ?? s.riskLevel ?? "medium",
    status: s.compliance_status ?? s.complianceStatus ?? "pending",
    lastAudit: s.last_audit_date ?? "—",
  }));

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical": return "#ef4444";
      case "high": return "#f59e0b";
      case "medium": return "#3b82f6";
      default: return "#10b981";
    }
  };

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>AI Governance</Text>
      <Text style={s.subtitle}>NDPA Art. 37 — Automated Decision-Making Registry</Text>

      <View style={s.stats}>
        <View style={s.statCard}><Text style={s.statNum}>{items.length}</Text><Text style={s.statLabel}>Systems</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#ef4444" }]}>{items.filter(i => i.riskLevel === "critical" || i.riskLevel === "high").length}</Text><Text style={s.statLabel}>High Risk</Text></View>
      </View>

      {items.map(sys => (
        <View key={sys.id} style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{sys.name}</Text>
            <View style={[s.badge, { backgroundColor: getRiskColor(sys.riskLevel) + "20" }]}>
              <Text style={[s.badgeText, { color: getRiskColor(sys.riskLevel) }]}>{sys.riskLevel}</Text>
            </View>
          </View>
          <Text style={s.cardMeta}>Status: {sys.status}</Text>
          <Text style={s.cardMeta}>Last audit: {sys.lastAudit}</Text>
        </View>
      ))}
      {items.length === 0 && <Text style={s.empty}>No AI models registered</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16 },
  stats: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: "#111827", borderRadius: 8, padding: 12, alignItems: "center" },
  statNum: { color: "#fff", fontSize: 20, fontWeight: "700" },
  statLabel: { color: "#9ca3af", fontSize: 11 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  cardMeta: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
});
