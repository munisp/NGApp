/**
 * IEC 62443 Cybersecurity Compliance — React Native Screen (v42)
 * Shows security zones, conduits, and compliance controls
 */
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, FlatList,
} from "react-native";

interface Control {
  id: number;
  controlId: string;
  title: string;
  zone: string;
  status: "not_started" | "in_progress" | "completed" | "not_applicable";
  silLevel: number;
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  byZone: Record<string, number>;
  completionPct: number;
}

const STATUS_COLOR: Record<string, string> = {
  completed: "#22c55e",
  in_progress: "#f59e0b",
  not_started: "#6b7280",
  not_applicable: "#3b82f6",
};

export default function Iec62443Screen() {
  const [controls, setControls] = useState<Control[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      // In production: call trpc.iec62443.listControls and getSummary
      setSummary({ total: 42, byStatus: { completed: 18, in_progress: 12, not_started: 12 }, byZone: { "OT Zone 1": 14, "OT Zone 2": 14, "DMZ": 14 }, completionPct: 43 });
      setControls([
        { id: 1, controlId: "IEC-SR-1.1", title: "Human User Identification and Authentication", zone: "OT Zone 1", status: "completed", silLevel: 2 },
        { id: 2, controlId: "IEC-SR-1.2", title: "Software Process and Device Identification", zone: "OT Zone 1", status: "in_progress", silLevel: 2 },
        { id: 3, controlId: "IEC-SR-2.1", title: "Authorization Enforcement", zone: "OT Zone 2", status: "not_started", silLevel: 3 },
        { id: 4, controlId: "IEC-SR-3.1", title: "Communication Integrity", zone: "DMZ", status: "completed", silLevel: 2 },
        { id: 5, controlId: "IEC-SR-4.1", title: "Information Confidentiality", zone: "DMZ", status: "in_progress", silLevel: 2 },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#f59e0b" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#f59e0b" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>IEC 62443</Text>
        <Text style={styles.subtitle}>Cybersecurity Compliance</Text>
      </View>

      {summary && (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Total Controls</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: "#22c55e" }]}>{summary.completionPct}%</Text>
            <Text style={styles.summaryLabel}>Completion</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: "#f59e0b" }]}>{summary.byStatus.in_progress ?? 0}</Text>
            <Text style={styles.summaryLabel}>In Progress</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: "#6b7280" }]}>{summary.byStatus.not_started ?? 0}</Text>
            <Text style={styles.summaryLabel}>Not Started</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Security Controls</Text>
      {controls.map((ctrl) => (
        <TouchableOpacity key={ctrl.id} style={styles.controlCard}>
          <View style={styles.controlHeader}>
            <Text style={styles.controlId}>{ctrl.controlId}</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[ctrl.status] + "33", borderColor: STATUS_COLOR[ctrl.status] }]}>
              <Text style={[styles.statusText, { color: STATUS_COLOR[ctrl.status] }]}>{ctrl.status.replace("_", " ")}</Text>
            </View>
          </View>
          <Text style={styles.controlTitle}>{ctrl.title}</Text>
          <View style={styles.controlMeta}>
            <Text style={styles.metaText}>Zone: {ctrl.zone}</Text>
            <Text style={styles.metaText}>SIL {ctrl.silLevel}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1117" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0d1117" },
  header: { padding: 20, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f59e0b" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 },
  summaryCard: { flex: 1, minWidth: "45%", backgroundColor: "#161b22", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#30363d" },
  summaryValue: { fontSize: 22, fontWeight: "bold", color: "#e6edf3" },
  summaryLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#e6edf3", paddingHorizontal: 16, paddingVertical: 8 },
  controlCard: { backgroundColor: "#161b22", marginHorizontal: 12, marginBottom: 8, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "#30363d" },
  controlHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  controlId: { fontSize: 12, fontWeight: "600", color: "#f59e0b", fontFamily: "monospace" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  controlTitle: { fontSize: 13, color: "#e6edf3", marginBottom: 6 },
  controlMeta: { flexDirection: "row", gap: 12 },
  metaText: { fontSize: 11, color: "#6b7280" },
});
