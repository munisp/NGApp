import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

const TIMELINE_ITEMS = [
  { time: "T+0h", title: "Breach Detected", desc: "Automated monitoring detected anomalous data access pattern", done: true },
  { time: "T+1h", title: "Incident Team Assembled", desc: "DPO notified, forensics team activated", done: true },
  { time: "T+4h", title: "Scope Assessment", desc: "Determine affected data subjects and data categories", done: true },
  { time: "T+12h", title: "Containment", desc: "Access revoked, vulnerability patched", done: false },
  { time: "T+48h", title: "NDPC Pre-notification", desc: "Initial report submitted to NDPC (within 72h per NDPA S.40)", done: false },
  { time: "T+72h", title: "NDPC Formal Notification", desc: "Full incident report with remediation plan", done: false },
  { time: "T+7d", title: "Data Subject Notification", desc: "Notify affected individuals if high risk (NDPA S.40(2))", done: false },
  { time: "T+30d", title: "Remediation Complete", desc: "All corrective actions implemented and verified", done: false },
];

export function BreachTimelineScreen() {
  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Breach Response Timeline</Text>
        <Text style={s.subtitle}>NDPA S.40 — Mandatory 72-hour notification</Text>
      </View>
      {TIMELINE_ITEMS.map((item, idx) => (
        <View key={idx} style={s.timelineRow}>
          <View style={s.lineCol}>
            <View style={[s.dot, item.done && s.dotDone]} />
            {idx < TIMELINE_ITEMS.length - 1 && <View style={[s.line, item.done && s.lineDone]} />}
          </View>
          <View style={s.contentCol}>
            <Text style={s.time}>{item.time}</Text>
            <Text style={[s.itemTitle, item.done && { color: "#10b981" }]}>{item.title}</Text>
            <Text style={s.desc}>{item.desc}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#ef4444", fontSize: 13, marginTop: 4 },
  timelineRow: { flexDirection: "row", paddingHorizontal: 20 },
  lineCol: { width: 30, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#374151", borderWidth: 2, borderColor: "#4b5563" },
  dotDone: { backgroundColor: "#10b981", borderColor: "#10b981" },
  line: { width: 2, flex: 1, backgroundColor: "#374151" },
  lineDone: { backgroundColor: "#10b981" },
  contentCol: { flex: 1, paddingLeft: 12, paddingBottom: 24 },
  time: { color: "#6b7280", fontSize: 11, fontWeight: "600" },
  itemTitle: { color: "#e5e7eb", fontSize: 16, fontWeight: "600", marginTop: 2 },
  desc: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
});
