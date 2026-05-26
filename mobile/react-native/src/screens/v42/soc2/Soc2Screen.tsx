/**
 * SOC 2 Audit Trail — React Native Screen (v42)
 */
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";

export default function Soc2Screen() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalControls: 0, byStatus: {} as Record<string, number>, recentEvents: 0 });
  const [events, setEvents] = useState<{ id: number; eventType: string; actorName: string; resourceType: string; eventTime: string; outcome: string }[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setSummary({ totalControls: 28, byStatus: { compliant: 20, non_compliant: 3, in_remediation: 5 }, recentEvents: 147 });
      setEvents([
        { id: 1, eventType: "user.login", actorName: "john.doe", resourceType: "system", eventTime: new Date().toISOString(), outcome: "success" },
        { id: 2, eventType: "data.export", actorName: "jane.smith", resourceType: "well_data", eventTime: new Date(Date.now() - 3600000).toISOString(), outcome: "success" },
        { id: 3, eventType: "config.change", actorName: "admin", resourceType: "alarm_rules", eventTime: new Date(Date.now() - 7200000).toISOString(), outcome: "success" },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f59e0b" /></View>;

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>SOC 2 Audit</Text>
        <Text style={s.subtitle}>Trust Services Criteria Compliance</Text>
      </View>
      <View style={s.grid}>
        <View style={s.card}><Text style={s.val}>{summary.totalControls}</Text><Text style={s.lbl}>Controls</Text></View>
        <View style={s.card}><Text style={[s.val, { color: "#22c55e" }]}>{summary.byStatus.compliant ?? 0}</Text><Text style={s.lbl}>Compliant</Text></View>
        <View style={s.card}><Text style={[s.val, { color: "#ef4444" }]}>{summary.byStatus.non_compliant ?? 0}</Text><Text style={s.lbl}>Non-Compliant</Text></View>
        <View style={s.card}><Text style={[s.val, { color: "#3b82f6" }]}>{summary.recentEvents}</Text><Text style={s.lbl}>Events (24h)</Text></View>
      </View>
      <Text style={s.section}>Recent Audit Events</Text>
      {events.map((ev) => (
        <View key={ev.id} style={s.eventRow}>
          <View style={s.eventDot} />
          <View style={s.eventBody}>
            <Text style={s.eventType}>{ev.eventType}</Text>
            <Text style={s.eventMeta}>{ev.actorName} · {ev.resourceType}</Text>
            <Text style={s.eventTime}>{new Date(ev.eventTime).toLocaleString()}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: ev.outcome === "success" ? "#22c55e22" : "#ef444422", borderColor: ev.outcome === "success" ? "#22c55e" : "#ef4444" }]}>
            <Text style={[s.badgeText, { color: ev.outcome === "success" ? "#22c55e" : "#ef4444" }]}>{ev.outcome}</Text>
          </View>
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
  grid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 },
  card: { flex: 1, minWidth: "45%", backgroundColor: "#161b22", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#30363d" },
  val: { fontSize: 22, fontWeight: "bold", color: "#e6edf3" },
  lbl: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  section: { fontSize: 16, fontWeight: "600", color: "#e6edf3", paddingHorizontal: 16, paddingVertical: 8 },
  eventRow: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#161b22", marginHorizontal: 12, marginBottom: 8, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#30363d" },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3b82f6", marginTop: 4, marginRight: 10 },
  eventBody: { flex: 1 },
  eventType: { fontSize: 13, color: "#e6edf3", fontWeight: "600", fontFamily: "monospace" },
  eventMeta: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  eventTime: { fontSize: 10, color: "#4b5563", marginTop: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "600" },
});
