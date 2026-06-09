import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

interface Audit {
  id: number;
  orgName: string;
  auditType: string;
  status: string;
  score: number;
  dueDate: string;
}

export function ComplianceAuditScreen() {
  const [audits] = React.useState<Audit[]>([
    { id: 1, orgName: "MTN Nigeria", auditType: "annual", status: "in_progress", score: 78, dueDate: "2026-07-15" },
    { id: 2, orgName: "Access Bank", auditType: "spot-check", status: "completed", score: 92, dueDate: "2026-05-30" },
    { id: 3, orgName: "Airtel Nigeria", auditType: "complaint-triggered", status: "pending", score: 0, dueDate: "2026-08-01" },
    { id: 4, orgName: "Flutterwave", auditType: "renewal", status: "findings", score: 65, dueDate: "2026-06-20" },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "#10b981";
      case "in_progress": return "#3b82f6";
      case "findings": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  const getScoreColor = (score: number) => score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Compliance Audits</Text>
      <Text style={s.subtitle}>NDPA Regulatory Audit Management</Text>

      <View style={s.stats}>
        <View style={s.statCard}><Text style={s.statNum}>{audits.length}</Text><Text style={s.statLabel}>Total</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#3b82f6" }]}>{audits.filter(a => a.status === "in_progress").length}</Text><Text style={s.statLabel}>Active</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#f59e0b" }]}>{audits.filter(a => a.status === "findings").length}</Text><Text style={s.statLabel}>Findings</Text></View>
      </View>

      {audits.map(audit => (
        <View key={audit.id} style={s.card}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>{audit.orgName}</Text>
              <Text style={s.cardType}>{audit.auditType.replace("-", " ")}</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              {audit.score > 0 && <Text style={[s.score, { color: getScoreColor(audit.score) }]}>{audit.score}%</Text>}
              <View style={[s.badge, { backgroundColor: getStatusColor(audit.status) + "20" }]}>
                <Text style={[s.badgeText, { color: getStatusColor(audit.status) }]}>{audit.status.replace("_", " ")}</Text>
              </View>
            </View>
          </View>
          <Text style={s.cardMeta}>Due: {audit.dueDate}</Text>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${audit.score}%`, backgroundColor: getScoreColor(audit.score) }]} />
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
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cardType: { color: "#6366f1", fontSize: 12, textTransform: "capitalize" },
  score: { fontSize: 18, fontWeight: "700" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  cardMeta: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  progressBar: { height: 4, backgroundColor: "#1f2937", borderRadius: 2, marginTop: 8 },
  progressFill: { height: 4, borderRadius: 2 },
});
