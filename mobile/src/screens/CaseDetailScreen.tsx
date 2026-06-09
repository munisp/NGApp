import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

export function CaseDetailScreen({ route }: { route: { params?: { caseId?: string } } }) {
  const caseId = route.params?.caseId ?? "—";
  return (
    <ScrollView style={s.container}>
      <View style={s.header}><Text style={s.title}>Case #{caseId}</Text></View>
      <View style={s.card}>
        <Text style={s.label}>Status</Text><Text style={s.value}>Under Investigation</Text>
        <Text style={s.label}>Severity</Text><Text style={s.value}>High</Text>
        <Text style={s.label}>Assigned To</Text><Text style={s.value}>Compliance Team</Text>
        <Text style={s.label}>Timeline</Text>
        <View style={s.timeline}>
          {["Case Opened", "Investigation Started", "Evidence Collection", "Pending Resolution"].map((step, i) => (
            <View key={i} style={s.timelineItem}>
              <View style={[s.dot, i <= 1 && { backgroundColor: "#10b981" }]} />
              <Text style={[s.stepText, i <= 1 && { color: "#10b981" }]}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  card: { backgroundColor: "#111827", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  label: { color: "#6b7280", fontSize: 12, marginTop: 12 },
  value: { color: "#e5e7eb", fontSize: 16, fontWeight: "600" },
  timeline: { marginTop: 12 },
  timelineItem: { flexDirection: "row", alignItems: "center", marginVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#374151", marginRight: 12 },
  stepText: { color: "#9ca3af", fontSize: 14 },
});
