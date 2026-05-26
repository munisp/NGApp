/**
 * Historian (QuestDB/TimescaleDB) — React Native Screen (v42)
 */
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";

export default function HistorianScreen() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total: 0, active: 0, byDataType: {} as Record<string, number> });
  const [streams, setStreams] = useState<{ id: number; tagName: string; dataType: string; isActive: boolean; retentionDays: number }[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setSummary({ total: 156, active: 148, byDataType: { float: 80, integer: 40, boolean: 36 } });
      setStreams([
        { id: 1, tagName: "WELL-001.PRESSURE", dataType: "float", isActive: true, retentionDays: 365 },
        { id: 2, tagName: "WELL-001.TEMPERATURE", dataType: "float", isActive: true, retentionDays: 365 },
        { id: 3, tagName: "FPSO-001.FLOWRATE", dataType: "float", isActive: true, retentionDays: 730 },
        { id: 4, tagName: "COMPRESSOR-01.STATUS", dataType: "boolean", isActive: true, retentionDays: 90 },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f59e0b" /></View>;

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Historian</Text>
        <Text style={s.subtitle}>QuestDB / TimescaleDB Time-Series</Text>
      </View>
      <View style={s.grid}>
        <View style={s.card}><Text style={s.val}>{summary.total}</Text><Text style={s.lbl}>Streams</Text></View>
        <View style={s.card}><Text style={[s.val, { color: "#22c55e" }]}>{summary.active}</Text><Text style={s.lbl}>Active</Text></View>
        <View style={s.card}><Text style={[s.val, { color: "#3b82f6" }]}>{summary.byDataType.float ?? 0}</Text><Text style={s.lbl}>Float Tags</Text></View>
        <View style={s.card}><Text style={[s.val, { color: "#a855f7" }]}>{summary.byDataType.boolean ?? 0}</Text><Text style={s.lbl}>Boolean Tags</Text></View>
      </View>
      <Text style={s.section}>Data Streams</Text>
      {streams.map((st) => (
        <TouchableOpacity key={st.id} style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowTitle}>{st.tagName}</Text>
            <Text style={s.rowMeta}>{st.dataType} · {st.retentionDays}d retention</Text>
          </View>
          <View style={[s.badge, { backgroundColor: st.isActive ? "#22c55e22" : "#6b728022", borderColor: st.isActive ? "#22c55e" : "#6b7280" }]}>
            <Text style={[s.badgeText, { color: st.isActive ? "#22c55e" : "#6b7280" }]}>{st.isActive ? "active" : "inactive"}</Text>
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
  rowTitle: { fontSize: 13, color: "#e6edf3", fontWeight: "600", fontFamily: "monospace" },
  rowMeta: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "600" },
});
