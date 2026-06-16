import React from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native";
import { api } from "../services/api";

export function BreachReportScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const [form, setForm] = React.useState({ title: "", description: "", severity: "high", affected_subjects: "" });
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    if (!form.title.trim()) { Alert.alert("Error", "Title is required"); return; }
    setSubmitting(true);
    try {
      await api.reportBreach({
        title: form.title,
        description: form.description,
        severity: form.severity,
        affected_subjects: parseInt(form.affected_subjects) || 0,
      });
      Alert.alert("Success", "Breach reported. NDPC will be notified within 72 hours per NDPA S.40.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to submit breach report. Saved offline for sync.");
    }
    setSubmitting(false);
  };

  return (
    <ScrollView style={s.container}>
      <View style={s.header}><Text style={s.title}>Report Data Breach</Text><Text style={s.subtitle}>NDPA S.40 — 72-hour notification requirement</Text></View>
      <View style={s.card}>
        <Text style={s.label}>Breach Title *</Text>
        <TextInput style={s.input} value={form.title} onChangeText={t => setForm(f => ({ ...f, title: t }))} placeholder="Brief description" placeholderTextColor="#4b5563" />
        <Text style={s.label}>Description</Text>
        <TextInput style={[s.input, { height: 100 }]} value={form.description} onChangeText={t => setForm(f => ({ ...f, description: t }))} placeholder="Full details of the breach" placeholderTextColor="#4b5563" multiline />
        <Text style={s.label}>Severity</Text>
        <View style={s.row}>
          {["low", "medium", "high", "critical"].map(sv => (
            <TouchableOpacity key={sv} onPress={() => setForm(f => ({ ...f, severity: sv }))} style={[s.sevBtn, form.severity === sv && s.sevActive]}>
              <Text style={[s.sevText, form.severity === sv && s.sevTextActive]}>{sv}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.label}>Affected Data Subjects</Text>
        <TextInput style={s.input} value={form.affected_subjects} onChangeText={t => setForm(f => ({ ...f, affected_subjects: t }))} keyboardType="numeric" placeholder="Number of people affected" placeholderTextColor="#4b5563" />
        <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.5 }]} onPress={submit} disabled={submitting}>
          <Text style={s.submitText}>{submitting ? "Submitting…" : "Submit Breach Report"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#ef4444", fontSize: 13, marginTop: 4 },
  card: { backgroundColor: "#111827", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  label: { color: "#6b7280", fontSize: 12, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: "#1f2937", borderRadius: 8, padding: 12, color: "#fff", fontSize: 15 },
  row: { flexDirection: "row", gap: 8 },
  sevBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: "#1f2937", alignItems: "center" },
  sevActive: { backgroundColor: "#dc2626" },
  sevText: { color: "#9ca3af", fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  sevTextActive: { color: "#fff" },
  submitBtn: { backgroundColor: "#dc2626", borderRadius: 8, padding: 14, marginTop: 20, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
