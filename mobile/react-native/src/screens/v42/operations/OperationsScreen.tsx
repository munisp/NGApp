/**
 * Operations v42 — React Native Screen
 * Production Allocation, Reservoir Sim, Emissions, Drone Inspection
 */
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";

type Tab = "allocation" | "emissions" | "drone";

export default function OperationsScreen() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("allocation");
  const [emissions, setEmissions] = useState({ totalCo2e: 0, sourcesCount: 0 });
  const [drones, setDrones] = useState({ total: 0, byStatus: {} as Record<string, number> });

  useEffect(() => {
    setTimeout(() => {
      setEmissions({ totalCo2e: 12450.5, sourcesCount: 8 });
      setDrones({ total: 15, byStatus: { completed: 8, in_progress: 3, scheduled: 4 } });
      setLoading(false);
    }, 500);
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f59e0b" /></View>;

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Operations v42</Text>
        <Text style={s.subtitle}>Allocation · Reservoir · Emissions · Drone</Text>
      </View>
      <View style={s.tabs}>
        {(["allocation", "emissions", "drone"] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === "allocation" && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Production Allocation Engine</Text>
          <Text style={s.infoText}>Prorates well production to field/facility totals using configurable allocation rules (volumetric, test-based, or model-driven).</Text>
          <View style={s.infoCard}>
            <Text style={s.infoCardTitle}>Allocation Methods</Text>
            <Text style={s.infoCardItem}>• Volumetric (test-based ratios)</Text>
            <Text style={s.infoCardItem}>• Model-driven (PINN predictions)</Text>
            <Text style={s.infoCardItem}>• Manual override with audit trail</Text>
          </View>
        </View>
      )}
      {tab === "emissions" && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Carbon & Emissions Accounting</Text>
          <View style={s.grid}>
            <View style={s.card}><Text style={[s.val, { color: "#ef4444" }]}>{emissions.totalCo2e.toFixed(0)}</Text><Text style={s.lbl}>tCO₂e Total</Text></View>
            <View style={s.card}><Text style={s.val}>{emissions.sourcesCount}</Text><Text style={s.lbl}>Sources</Text></View>
          </View>
        </View>
      )}
      {tab === "drone" && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Drone Inspection Management</Text>
          <View style={s.grid}>
            <View style={s.card}><Text style={s.val}>{drones.total}</Text><Text style={s.lbl}>Total</Text></View>
            <View style={s.card}><Text style={[s.val, { color: "#22c55e" }]}>{drones.byStatus.completed ?? 0}</Text><Text style={s.lbl}>Completed</Text></View>
            <View style={s.card}><Text style={[s.val, { color: "#f59e0b" }]}>{drones.byStatus.in_progress ?? 0}</Text><Text style={s.lbl}>In Progress</Text></View>
            <View style={s.card}><Text style={[s.val, { color: "#3b82f6" }]}>{drones.byStatus.scheduled ?? 0}</Text><Text style={s.lbl}>Scheduled</Text></View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1117" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0d1117" },
  header: { padding: 20, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f59e0b" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  tabs: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: "#161b22", borderWidth: 1, borderColor: "#30363d", alignItems: "center" },
  tabActive: { backgroundColor: "#f59e0b22", borderColor: "#f59e0b" },
  tabText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  tabTextActive: { color: "#f59e0b" },
  section: { padding: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#e6edf3", marginBottom: 8 },
  infoText: { fontSize: 13, color: "#9ca3af", lineHeight: 20, marginBottom: 12 },
  infoCard: { backgroundColor: "#161b22", borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "#30363d" },
  infoCardTitle: { fontSize: 13, fontWeight: "600", color: "#e6edf3", marginBottom: 8 },
  infoCardItem: { fontSize: 12, color: "#9ca3af", marginBottom: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { flex: 1, minWidth: "45%", backgroundColor: "#161b22", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#30363d" },
  val: { fontSize: 22, fontWeight: "bold", color: "#e6edf3" },
  lbl: { fontSize: 11, color: "#6b7280", marginTop: 2 },
});
