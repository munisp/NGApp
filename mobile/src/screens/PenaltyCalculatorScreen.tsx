import React from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity } from "react-native";

export function PenaltyCalculatorScreen() {
  const [revenue, setRevenue] = React.useState("");
  const [severity, setSeverity] = React.useState("medium");
  const [result, setResult] = React.useState<{ amount: number; basis: string } | null>(null);

  const calculate = () => {
    const rev = parseFloat(revenue) || 0;
    const baseMin = 10_000_000; // ₦10M minimum per NDPA S.47
    let pct = severity === "critical" ? 0.02 : severity === "high" ? 0.015 : severity === "medium" ? 0.01 : 0.005;
    const calculated = Math.max(rev * pct, baseMin);
    setResult({ amount: calculated, basis: `${(pct * 100).toFixed(1)}% of annual revenue or ₦10M minimum (NDPA Art. 47)` });
  };

  return (
    <ScrollView style={s.container}>
      <View style={s.header}><Text style={s.title}>Penalty Calculator</Text><Text style={s.subtitle}>NDPA Art. 47 — Administrative Penalties</Text></View>
      <View style={s.card}>
        <Text style={s.label}>Annual Gross Revenue (₦)</Text>
        <TextInput style={s.input} value={revenue} onChangeText={setRevenue} keyboardType="numeric" placeholder="e.g. 5000000000" placeholderTextColor="#4b5563" />
        <Text style={s.label}>Violation Severity</Text>
        <View style={s.row}>
          {["low", "medium", "high", "critical"].map(s2 => (
            <TouchableOpacity key={s2} onPress={() => setSeverity(s2)} style={[s.sevBtn, severity === s2 && s.sevActive]}>
              <Text style={[s.sevText, severity === s2 && s.sevTextActive]}>{s2}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.calcBtn} onPress={calculate}>
          <Text style={s.calcText}>Calculate Penalty</Text>
        </TouchableOpacity>
        {result && (
          <View style={s.resultBox}>
            <Text style={s.resultAmount}>₦{result.amount.toLocaleString()}</Text>
            <Text style={s.resultBasis}>{result.basis}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginTop: 4 },
  card: { backgroundColor: "#111827", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  label: { color: "#6b7280", fontSize: 12, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: "#1f2937", borderRadius: 8, padding: 12, color: "#fff", fontSize: 16 },
  row: { flexDirection: "row", gap: 8, marginTop: 4 },
  sevBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: "#1f2937", alignItems: "center" },
  sevActive: { backgroundColor: "#10b981" },
  sevText: { color: "#9ca3af", fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  sevTextActive: { color: "#fff" },
  calcBtn: { backgroundColor: "#10b981", borderRadius: 8, padding: 14, marginTop: 16, alignItems: "center" },
  calcText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  resultBox: { marginTop: 16, padding: 16, backgroundColor: "#064e3b", borderRadius: 8 },
  resultAmount: { color: "#10b981", fontSize: 32, fontWeight: "800", textAlign: "center" },
  resultBasis: { color: "#6ee7b7", fontSize: 12, textAlign: "center", marginTop: 4 },
});
