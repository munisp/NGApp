/**
 * SIL 2 Functional Safety — React Native Screen (v42)
 */
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";

export default function SilScreen() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total: 0, overdueTests: 0, bySil: {} as Record<number, number> });
  const [functions, setFunctions] = useState<{ id: number; name: string; targetSil: number; status: string; nextTestDue: string | null }[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setSummary({ total: 12, overdueTests: 2, bySil: { 1: 3, 2: 7, 3: 2 } });
      setFunctions([
        { id: 1, name: "High Pressure Shutdown (HIPPS)", targetSil: 2, status: "active", nextTestDue: "2025-06-01" },
        { id: 2, name: "Emergency Depressurization (EDP)", targetSil: 3, status: "active", nextTestDue: "2025-03-15" },
        { id: 3, name: "Fire & Gas Detection Shutdown", targetSil: 2, status: "active", nextTestDue: "2025-09-01" },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f59e0b" /></View>;

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>SIL 2 Safety</Text>
        <Text style={s.subtitle}>Functional Safety Management</Text>
      </View>
      <View style={s.grid}>
        <View style={s.card}><Text style={s.val}>{summary.total}</Text><Text style={s.lbl}>SIFs</Text></View>
        <View style={s.card}><Text style={[s.val, { color: "#ef4444" }]}>{summary.overdueTests}</Text><Text style={s.lbl}>Overdue Tests</Text></View>
        <View style={s.card}><Text style={[s.val, { color: "#22c55e" }]}>{summary.bySil[2] ?? 0}</Text><Text style={s.lbl}>SIL 2</Text></View>
        <View style={s.card}><Text style={[s.val, { color: "#f59e0b" }]}>{summary.bySil[3] ?? 0}</Text><Text style={s.lbl}>SIL 3</Text></View>
      </View>
      <Text style={s.section}>Safety Instrumented Functions</Text>
      {functions.map((fn) => (
        <TouchableOpacity key={fn.id} style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowTitle}>{fn.name}</Text>
            <Text style={s.rowMeta}>SIL {fn.targetSil} · Next test: {fn.nextTestDue ?? "N/A"}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: fn.status === "active" ? "#22c55e22" : "#6b728022", borderColor: fn.status === "active" ? "#22c55e" : "#6b7280" }]}>
            <Text style={[s.badgeText, { color: fn.status === "active" ? "#22c55e" : "#6b7280" }]}>{fn.status}</Text>
          </View>
        </TouchableOpacity>
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
  grid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 },
  card: { flex: 1, minWidth: "45%", backgroundColor: "#161b22", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#30363d" },
  val: { fontSize: 22, fontWeight: "bold", color: "#e6edf3" },
  lbl: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  section: { fontSize: 16, fontWeight: "600", color: "#e6edf3", paddingHorizontal: 16, paddingVertical: 8 },
  row: { backgroundColor: "#161b22", marginHorizontal: 12, marginBottom: 8, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "#30363d", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLeft: { flex: 1 },
  rowTitle: { fontSize: 13, color: "#e6edf3", fontWeight: "600" },
  rowMeta: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "600" },
});
