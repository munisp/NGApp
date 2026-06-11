import React from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function CaseDetailScreen({ route }: { route?: { params?: { caseId?: number } } }) {
  const caseId = route?.params?.caseId;
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["enforcement-cases"],
    queryFn: () => api.getEnforcementCases(),
    staleTime: 30_000,
  });
  const caseData = (cases as any[]).find((c: any) => c.id === caseId) ?? (cases as any[])[0];

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  if (!caseData) return <View style={s.container}><Text style={s.empty}>No case found</Text></View>;

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Case #{caseData.case_number ?? caseData.id}</Text>
      <View style={s.card}>
        <Text style={s.label}>Status</Text><Text style={s.value}>{caseData.status}</Text>
        <Text style={s.label}>Severity</Text><Text style={s.value}>{caseData.severity ?? "—"}</Text>
        <Text style={s.label}>Organisation</Text><Text style={s.value}>Org #{caseData.org_id ?? "—"}</Text>
        <Text style={s.label}>Created</Text><Text style={s.value}>{caseData.created_at ? new Date(caseData.created_at).toLocaleDateString() : "—"}</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 16 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16 },
  label: { color: "#9ca3af", fontSize: 12, marginTop: 12 },
  value: { color: "#fff", fontSize: 16, fontWeight: "600" },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
});
