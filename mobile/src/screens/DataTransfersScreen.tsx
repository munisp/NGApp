import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

interface Transfer {
  id: number;
  destination: string;
  basis: string;
  status: string;
  dataType: string;
  mechanism: string;
}

export function DataTransfersScreen() {
  const [transfers] = React.useState<Transfer[]>([
    { id: 1, destination: "United Kingdom", basis: "Adequacy Decision", status: "approved", dataType: "Employee HR", mechanism: "Standard Contractual Clauses" },
    { id: 2, destination: "United States", basis: "Binding Corporate Rules", status: "pending", dataType: "Customer Analytics", mechanism: "BCR" },
    { id: 3, destination: "South Africa", basis: "Adequacy Decision", status: "approved", dataType: "Financial Records", mechanism: "POPIA Adequacy" },
    { id: 4, destination: "Singapore", basis: "Explicit Consent", status: "under_review", dataType: "Health Records", mechanism: "Consent + DPIA" },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "#10b981";
      case "pending": return "#f59e0b";
      case "rejected": return "#ef4444";
      default: return "#6366f1";
    }
  };

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Cross-Border Transfers</Text>
      <Text style={s.subtitle}>NDPA Part III — International Data Transfers</Text>

      <View style={s.stats}>
        <View style={s.statCard}>
          <Text style={s.statNum}>{transfers.length}</Text>
          <Text style={s.statLabel}>Active</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: "#10b981" }]}>{transfers.filter(t => t.status === "approved").length}</Text>
          <Text style={s.statLabel}>Approved</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: "#f59e0b" }]}>{transfers.filter(t => t.status === "pending").length}</Text>
          <Text style={s.statLabel}>Pending</Text>
        </View>
      </View>

      {transfers.map(t => (
        <View key={t.id} style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{t.destination}</Text>
            <View style={[s.badge, { backgroundColor: getStatusColor(t.status) + "20" }]}>
              <Text style={[s.badgeText, { color: getStatusColor(t.status) }]}>{t.status.replace("_", " ")}</Text>
            </View>
          </View>
          <Text style={s.cardMeta}>Data: {t.dataType}</Text>
          <Text style={s.cardMeta}>Basis: {t.basis}</Text>
          <Text style={s.cardMeta}>Mechanism: {t.mechanism}</Text>
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
});
