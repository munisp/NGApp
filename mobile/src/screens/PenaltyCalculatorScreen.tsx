import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function PenaltyCalculatorScreen() {
  const [severity, setSeverity] = React.useState("medium");
  const [records, setRecords] = React.useState("5000");
  const [turnover, setTurnover] = React.useState("100000000");
  const [repeat, setRepeat] = React.useState(false);

  const severities = ["low", "medium", "high", "critical"];
  const baseAmounts: Record<string, number> = { low: 500000, medium: 2000000, high: 5000000, critical: 10000000 };
  const recordsNum = Number(records) || 0;
  const turnoverNum = Number(turnover) || 0;

  let recordsMultiplier = 1.0;
  if (recordsNum >= 100000) recordsMultiplier = 2.0;
  else if (recordsNum >= 50000) recordsMultiplier = 1.5;
  else if (recordsNum >= 10000) recordsMultiplier = 1.2;

  const repeatMultiplier = repeat ? 1.5 : 1.0;
  let total = (baseAmounts[severity] ?? 2000000) * recordsMultiplier * repeatMultiplier;
  if (turnoverNum > 0) total = Math.min(total, turnoverNum * 0.02);
  if (severity !== "critical") total = Math.min(total, 10000000);

  const { data: metrics } = useQuery({ queryKey: ["platform-metrics"], queryFn: () => api.getPlatformMetrics(), staleTime: 60_000 });

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Penalty Calculator</Text>
      <Text style={s.subtitle}>NDPA Article 47 — Penalty Estimation</Text>
      <View style={s.card}>
        <Text style={s.label}>Severity</Text>
        <View style={s.row}>{severities.map(sev => (
          <TouchableOpacity key={sev} style={[s.chip, severity === sev && s.chipActive]} onPress={() => setSeverity(sev)}>
            <Text style={[s.chipText, severity === sev && s.chipTextActive]}>{sev}</Text>
          </TouchableOpacity>
        ))}</View>
        <Text style={s.label}>Affected Records</Text>
        <TextInput style={s.input} value={records} onChangeText={setRecords} keyboardType="numeric" placeholderTextColor="#6b7280" />
        <Text style={s.label}>Annual Turnover (NGN)</Text>
        <TextInput style={s.input} value={turnover} onChangeText={setTurnover} keyboardType="numeric" placeholderTextColor="#6b7280" />
        <TouchableOpacity style={[s.chip, repeat && s.chipActive, { alignSelf: "flex-start", marginTop: 8 }]} onPress={() => setRepeat(!repeat)}>
          <Text style={[s.chipText, repeat && s.chipTextActive]}>Repeat Offender (+50%)</Text>
        </TouchableOpacity>
      </View>
      <View style={[s.card, { alignItems: "center" }]}>
        <Text style={s.resultLabel}>Estimated Penalty</Text>
        <Text style={s.resultAmount}>₦{total.toLocaleString()}</Text>
        <Text style={s.resultMeta}>Base: ₦{(baseAmounts[severity] ?? 0).toLocaleString()} × {recordsMultiplier} (records) × {repeatMultiplier} (repeat)</Text>
        {turnoverNum > 0 && <Text style={s.resultMeta}>Cap: 2% of turnover = ₦{(turnoverNum * 0.02).toLocaleString()}</Text>}
      </View>
      {metrics && <Text style={s.platformInfo}>Platform: {(metrics as any).activeCases ?? 0} active cases</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 16 },
  label: { color: "#9ca3af", fontSize: 12, marginTop: 12, marginBottom: 4 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { backgroundColor: "#1f2937", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: "#3b82f6" },
  chipText: { color: "#9ca3af", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  input: { backgroundColor: "#1f2937", color: "#fff", borderRadius: 8, padding: 10, fontSize: 16 },
  resultLabel: { color: "#9ca3af", fontSize: 14 },
  resultAmount: { color: "#ef4444", fontSize: 36, fontWeight: "700", marginTop: 4 },
  resultMeta: { color: "#6b7280", fontSize: 12, marginTop: 4, textAlign: "center" },
  platformInfo: { color: "#6b7280", fontSize: 12, textAlign: "center", marginTop: 8 },
});
