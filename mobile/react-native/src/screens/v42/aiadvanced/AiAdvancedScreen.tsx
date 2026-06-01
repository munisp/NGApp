/**
 * PINN & Agentic AI — React Native Screen (v42)
 */
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";

export default function AiAdvancedScreen() {
  const [loading, setLoading] = useState(true);
  const [pinnModels, setPinnModels] = useState<{ id: number; name: string; modelType: string; status: string; accuracy: number | null }[]>([]);
  const [workflows, setWorkflows] = useState<{ id: number; name: string; triggerType: string; isEnabled: boolean }[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setPinnModels([
        { id: 1, name: "Well ALPHA-001 IPR Model", modelType: "inflow_performance", status: "trained", accuracy: 0.94 },
        { id: 2, name: "Field-Wide Nodal Analysis", modelType: "nodal_analysis", status: "training", accuracy: null },
        { id: 3, name: "Reservoir Pressure Predictor", modelType: "reservoir_pressure", status: "trained", accuracy: 0.91 },
      ]);
      setWorkflows([
        { id: 1, name: "Auto Alarm Triage", triggerType: "alarm", isEnabled: true },
        { id: 2, name: "Daily Production Report", triggerType: "schedule", isEnabled: true },
        { id: 3, name: "Anomaly Root Cause Analysis", triggerType: "anomaly", isEnabled: false },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f59e0b" /></View>;

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>PINN & Agentic AI</Text>
        <Text style={s.subtitle}>Physics-Informed Neural Networks + Autonomous Workflows</Text>
      </View>
      <Text style={s.section}>PINN Models</Text>
      {pinnModels.map((m) => (
        <View key={m.id} style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{m.name}</Text>
            <View style={[s.badge, { backgroundColor: m.status === "trained" ? "#22c55e22" : "#f59e0b22", borderColor: m.status === "trained" ? "#22c55e" : "#f59e0b" }]}>
              <Text style={[s.badgeText, { color: m.status === "trained" ? "#22c55e" : "#f59e0b" }]}>{m.status}</Text>
            </View>
          </View>
          <Text style={s.cardMeta}>{m.modelType.replace(/_/g, " ")}</Text>
          {m.accuracy !== null && <Text style={s.accuracy}>Accuracy: {(m.accuracy * 100).toFixed(1)}%</Text>}
        </View>
      ))}
      <Text style={s.section}>Agentic Workflows</Text>
      {workflows.map((wf) => (
        <View key={wf.id} style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{wf.name}</Text>
            <View style={[s.badge, { backgroundColor: wf.isEnabled ? "#22c55e22" : "#6b728022", borderColor: wf.isEnabled ? "#22c55e" : "#6b7280" }]}>
              <Text style={[s.badgeText, { color: wf.isEnabled ? "#22c55e" : "#6b7280" }]}>{wf.isEnabled ? "enabled" : "disabled"}</Text>
            </View>
          </View>
          <Text style={s.cardMeta}>Trigger: {wf.triggerType}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1117" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0d1117" },
  header: { padding: 20, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f59e0b" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  section: { fontSize: 16, fontWeight: "600", color: "#e6edf3", paddingHorizontal: 16, paddingVertical: 8 },
  card: { backgroundColor: "#161b22", marginHorizontal: 12, marginBottom: 8, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "#30363d" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 13, color: "#e6edf3", fontWeight: "600", flex: 1, marginRight: 8 },
  cardMeta: { fontSize: 11, color: "#6b7280" },
  accuracy: { fontSize: 12, color: "#22c55e", marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "600" },
});
