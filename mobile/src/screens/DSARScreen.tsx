import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList } from "react-native";

interface DSARRequest {
  id: number;
  type: string;
  status: string;
  subject: string;
  deadline: string;
}

export function DSARScreen() {
  const [requests, setRequests] = React.useState<DSARRequest[]>([
    { id: 1, type: "Access", status: "in_progress", subject: "John Doe", deadline: "2026-06-15" },
    { id: 2, type: "Erasure", status: "pending", subject: "Jane Smith", deadline: "2026-06-20" },
    { id: 3, type: "Portability", status: "completed", subject: "Adamu Ibrahim", deadline: "2026-06-10" },
    { id: 4, type: "Rectification", status: "overdue", subject: "Fatima Bello", deadline: "2026-06-01" },
  ]);
  const [filter, setFilter] = React.useState<string>("all");

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "#10b981";
      case "in_progress": return "#f59e0b";
      case "overdue": return "#ef4444";
      default: return "#6b7280";
    }
  };

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>DSAR Requests</Text>
      <Text style={s.subtitle}>Data Subject Access Request Management</Text>

      <View style={s.filterRow}>
        {["all", "pending", "in_progress", "completed", "overdue"].map(f => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterActiveText]}>{f.replace("_", " ")}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.stats}>
        <View style={s.statCard}><Text style={s.statNum}>{requests.length}</Text><Text style={s.statLabel}>Total</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#ef4444" }]}>{requests.filter(r => r.status === "overdue").length}</Text><Text style={s.statLabel}>Overdue</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#f59e0b" }]}>{requests.filter(r => r.status === "in_progress").length}</Text><Text style={s.statLabel}>Active</Text></View>
      </View>

      {filtered.map(req => (
        <View key={req.id} style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{req.type} Request</Text>
            <View style={[s.badge, { backgroundColor: getStatusColor(req.status) + "20" }]}>
              <Text style={[s.badgeText, { color: getStatusColor(req.status) }]}>{req.status}</Text>
            </View>
          </View>
          <Text style={s.cardMeta}>Subject: {req.subject}</Text>
          <Text style={s.cardMeta}>Deadline: {req.deadline}</Text>
          <Text style={s.cardMeta}>SLA: 30 days (NDPA Art. 34)</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#1f2937" },
  filterActive: { backgroundColor: "#10b981" },
  filterText: { color: "#9ca3af", fontSize: 12, textTransform: "capitalize" },
  filterActiveText: { color: "#fff" },
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
