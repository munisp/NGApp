import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

interface AISystem {
  id: number;
  name: string;
  riskLevel: string;
  complianceScore: number;
  lastAssessed: string;
  purpose: string;
}

export function AIGovernanceScreen() {
  const [systems] = React.useState<AISystem[]>([
    { id: 1, name: "Credit Scoring AI", riskLevel: "high", complianceScore: 72, lastAssessed: "2026-05-15", purpose: "Automated credit decisions" },
    { id: 2, name: "Fraud Detection ML", riskLevel: "medium", complianceScore: 88, lastAssessed: "2026-06-01", purpose: "Transaction monitoring" },
    { id: 3, name: "Customer Chatbot", riskLevel: "low", complianceScore: 95, lastAssessed: "2026-05-20", purpose: "Customer service automation" },
    { id: 4, name: "KYC Face Match", riskLevel: "high", complianceScore: 81, lastAssessed: "2026-04-10", purpose: "Identity verification" },
    { id: 5, name: "Risk Profiling Engine", riskLevel: "critical", complianceScore: 56, lastAssessed: "2026-03-28", purpose: "Automated profiling under NDPA Art. 37" },
  ]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical": return "#ef4444";
      case "high": return "#f59e0b";
      case "medium": return "#3b82f6";
      default: return "#10b981";
    }
  };

  const getScoreColor = (score: number) => score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>AI Governance</Text>
      <Text style={s.subtitle}>NDPA Art. 37 — Automated Decision-Making Registry</Text>

      <View style={s.stats}>
        <View style={s.statCard}><Text style={s.statNum}>{systems.length}</Text><Text style={s.statLabel}>Systems</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#ef4444" }]}>{systems.filter(s => s.riskLevel === "critical" || s.riskLevel === "high").length}</Text><Text style={s.statLabel}>High Risk</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#10b981" }]}>{Math.round(systems.reduce((a, b) => a + b.complianceScore, 0) / systems.length)}%</Text><Text style={s.statLabel}>Avg Score</Text></View>
      </View>

      {systems.map(sys => (
        <View key={sys.id} style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{sys.name}</Text>
            <View style={[s.badge, { backgroundColor: getRiskColor(sys.riskLevel) + "20" }]}>
              <Text style={[s.badgeText, { color: getRiskColor(sys.riskLevel) }]}>{sys.riskLevel}</Text>
            </View>
          </View>
          <Text style={s.cardMeta}>{sys.purpose}</Text>
          <Text style={s.cardMeta}>Last assessed: {sys.lastAssessed}</Text>
          <View style={s.scoreRow}>
            <Text style={[s.scoreLabel, { color: getScoreColor(sys.complianceScore) }]}>Compliance: {sys.complianceScore}%</Text>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${sys.complianceScore}%`, backgroundColor: getScoreColor(sys.complianceScore) }]} />
            </View>
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
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  cardMeta: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  scoreRow: { marginTop: 8 },
  scoreLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  progressBar: { height: 4, backgroundColor: "#1f2937", borderRadius: 2 },
  progressFill: { height: 4, borderRadius: 2 },
});
