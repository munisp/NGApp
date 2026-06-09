import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

interface Workflow {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  currentStep: string;
  progress: number;
}

export function WorkflowsScreen() {
  const [workflows] = React.useState<Workflow[]>([
    { id: "enforcement-101", type: "Enforcement Lifecycle", status: "running", startedAt: "2026-06-05", currentStep: "evidence-collection", progress: 40 },
    { id: "breach-205", type: "Breach Response", status: "running", startedAt: "2026-06-07", currentStep: "ndpc-notification", progress: 60 },
    { id: "audit-44", type: "Compliance Audit", status: "completed", startedAt: "2026-05-20", currentStep: "follow-up", progress: 100 },
    { id: "dsar-312", type: "DSAR Fulfillment", status: "running", startedAt: "2026-06-08", currentStep: "data-collection", progress: 30 },
    { id: "enforcement-99", type: "Enforcement Lifecycle", status: "failed", startedAt: "2026-05-28", currentStep: "hearing", progress: 50 },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "#10b981";
      case "running": return "#3b82f6";
      case "failed": return "#ef4444";
      default: return "#6b7280";
    }
  };

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Temporal Workflows</Text>
      <Text style={s.subtitle}>Long-Running Process Orchestration</Text>

      <View style={s.stats}>
        <View style={s.statCard}><Text style={s.statNum}>{workflows.filter(w => w.status === "running").length}</Text><Text style={s.statLabel}>Running</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#10b981" }]}>{workflows.filter(w => w.status === "completed").length}</Text><Text style={s.statLabel}>Complete</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#ef4444" }]}>{workflows.filter(w => w.status === "failed").length}</Text><Text style={s.statLabel}>Failed</Text></View>
      </View>

      {workflows.map(wf => (
        <View key={wf.id} style={s.card}>
          <View style={s.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{wf.type}</Text>
              <Text style={s.cardId}>{wf.id}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: getStatusColor(wf.status) + "20" }]}>
              <Text style={[s.badgeText, { color: getStatusColor(wf.status) }]}>{wf.status}</Text>
            </View>
          </View>
          <Text style={s.cardMeta}>Step: {wf.currentStep.replace("-", " ")}</Text>
          <Text style={s.cardMeta}>Started: {wf.startedAt}</Text>
          <View style={s.progressRow}>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${wf.progress}%`, backgroundColor: getStatusColor(wf.status) }]} />
            </View>
            <Text style={s.progressText}>{wf.progress}%</Text>
          </View>
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
  cardId: { color: "#6b7280", fontSize: 11, fontFamily: "monospace" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  cardMeta: { color: "#9ca3af", fontSize: 13, marginTop: 4, textTransform: "capitalize" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  progressBar: { flex: 1, height: 4, backgroundColor: "#1f2937", borderRadius: 2 },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { color: "#9ca3af", fontSize: 12 },
});
