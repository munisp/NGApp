import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function ComplianceDetailScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data: score, refetch: refetchScore } = useQuery({
    queryKey: ["compliance-score"],
    queryFn: () => api.getComplianceScore(),
    staleTime: 30_000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchScore();
    setRefreshing(false);
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}>
      <View style={styles.header}>
        <Text style={styles.title}>Compliance Overview</Text>
        <Text style={styles.subtitle}>NDPA/NDPR Compliance Status</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Overall Score</Text>
        <Text style={styles.scoreText}>{score?.overall_score ?? "—"}/100</Text>
        <Text style={styles.gradeText}>Grade: {score?.grade ?? "N/A"}</Text>
      </View>

      {(score?.dimensions ?? []).map((dim: { name: string; score: number; status: string }, idx: number) => (
        <View key={idx} style={styles.card}>
          <View style={styles.dimRow}>
            <Text style={styles.dimName}>{dim.name}</Text>
            <Text style={[styles.dimScore, { color: dim.score >= 80 ? "#10b981" : dim.score >= 60 ? "#f59e0b" : "#ef4444" }]}>
              {dim.score}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${dim.score}%`, backgroundColor: dim.score >= 80 ? "#10b981" : dim.score >= 60 ? "#f59e0b" : "#ef4444" }]} />
          </View>
          <Text style={styles.dimStatus}>{dim.status}</Text>
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        {["Run Compliance Audit", "Generate DPIA", "Submit Annual Report", "View Violations"].map((action, i) => (
          <TouchableOpacity key={i} style={styles.actionBtn}>
            <Text style={styles.actionText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginTop: 4 },
  card: { backgroundColor: "#111827", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  cardTitle: { color: "#d1d5db", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  scoreText: { color: "#10b981", fontSize: 48, fontWeight: "800", textAlign: "center" },
  gradeText: { color: "#9ca3af", fontSize: 16, textAlign: "center", marginTop: 4 },
  dimRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dimName: { color: "#e5e7eb", fontSize: 14, fontWeight: "500" },
  dimScore: { fontSize: 16, fontWeight: "700" },
  progressBar: { height: 6, backgroundColor: "#374151", borderRadius: 3, marginTop: 8, marginBottom: 4 },
  progressFill: { height: 6, borderRadius: 3 },
  dimStatus: { color: "#6b7280", fontSize: 12 },
  actionBtn: { backgroundColor: "#1f2937", borderRadius: 8, padding: 12, marginTop: 8 },
  actionText: { color: "#10b981", fontSize: 14, fontWeight: "600", textAlign: "center" },
});
