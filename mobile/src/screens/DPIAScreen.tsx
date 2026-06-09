import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

interface DPIA {
  id: number;
  title: string;
  orgName: string;
  riskLevel: string;
  status: string;
  completionPercent: number;
}

export function DPIAScreen() {
  const [dpias] = React.useState<DPIA[]>([
    { id: 1, title: "Customer Biometric Authentication", orgName: "GTBank", riskLevel: "high", status: "in_progress", completionPercent: 65 },
    { id: 2, title: "Employee Monitoring System", orgName: "Dangote Group", riskLevel: "high", status: "completed", completionPercent: 100 },
    { id: 3, title: "Marketing Analytics Platform", orgName: "MTN Nigeria", riskLevel: "medium", status: "review", completionPercent: 90 },
    { id: 4, title: "Health Data Processing", orgName: "54gene", riskLevel: "critical", status: "pending", completionPercent: 0 },
  ]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical": return "#ef4444";
      case "high": return "#f59e0b";
      case "medium": return "#3b82f6";
      default: return "#10b981";
    }
  };

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>DPIA Assessments</Text>
      <Text style={s.subtitle}>Data Protection Impact Assessment — NDPA Art. 36</Text>

      <View style={s.stats}>
        <View style={s.statCard}><Text style={s.statNum}>{dpias.length}</Text><Text style={s.statLabel}>Total</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#3b82f6" }]}>{dpias.filter(d => d.status === "in_progress").length}</Text><Text style={s.statLabel}>Active</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#ef4444" }]}>{dpias.filter(d => d.riskLevel === "critical" || d.riskLevel === "high").length}</Text><Text style={s.statLabel}>High Risk</Text></View>
      </View>

      {dpias.map(dpia => (
        <View key={dpia.id} style={s.card}>
          <View style={s.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{dpia.title}</Text>
              <Text style={s.cardOrg}>{dpia.orgName}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: getRiskColor(dpia.riskLevel) + "20" }]}>
              <Text style={[s.badgeText, { color: getRiskColor(dpia.riskLevel) }]}>{dpia.riskLevel}</Text>
            </View>
          </View>
          <View style={s.progressRow}>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${dpia.completionPercent}%` }]} />
            </View>
            <Text style={s.progressText}>{dpia.completionPercent}%</Text>
          </View>
          <Text style={s.cardMeta}>Status: {dpia.status.replace("_", " ")}</Text>
        </View>
      ))}
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
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cardOrg: { color: "#6366f1", fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  progressBar: { flex: 1, height: 4, backgroundColor: "#1f2937", borderRadius: 2 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: "#10b981" },
  progressText: { color: "#9ca3af", fontSize: 12 },
  cardMeta: { color: "#9ca3af", fontSize: 13, marginTop: 4, textTransform: "capitalize" },
});
