import React from "react";
import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity } from "react-native";

export function SecurityScreen() {
  const [biometric, setBiometric] = React.useState(true);
  const [twoFactor, setTwoFactor] = React.useState(false);
  const [autoLock, setAutoLock] = React.useState(true);

  return (
    <ScrollView style={s.container}>
      <View style={s.header}><Text style={s.title}>Security</Text></View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Authentication</Text>
        <View style={s.toggleRow}><Text style={s.toggleLabel}>Biometric Login (Face ID / Fingerprint)</Text><Switch value={biometric} onValueChange={setBiometric} trackColor={{ true: "#10b981" }} /></View>
        <View style={s.toggleRow}><Text style={s.toggleLabel}>Two-Factor Authentication</Text><Switch value={twoFactor} onValueChange={setTwoFactor} trackColor={{ true: "#10b981" }} /></View>
        <View style={s.toggleRow}><Text style={s.toggleLabel}>Auto-Lock (5 min)</Text><Switch value={autoLock} onValueChange={setAutoLock} trackColor={{ true: "#10b981" }} /></View>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Session Management</Text>
        <Text style={s.label}>Current Session</Text><Text style={s.value}>Active — {new Date().toLocaleString()}</Text>
        <Text style={s.label}>Device</Text><Text style={s.value}>NDSEP Mobile App</Text>
        <TouchableOpacity style={s.btn}><Text style={s.btnText}>Revoke All Other Sessions</Text></TouchableOpacity>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Data Protection</Text>
        <Text style={s.infoText}>All data encrypted at rest using AES-256-GCM. Network traffic protected via TLS 1.3. Authentication tokens stored in device Secure Enclave (iOS) / Android Keystore.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  card: { backgroundColor: "#111827", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  cardTitle: { color: "#d1d5db", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  toggleLabel: { color: "#e5e7eb", fontSize: 14, flex: 1, marginRight: 8 },
  label: { color: "#6b7280", fontSize: 12, marginTop: 8 },
  value: { color: "#e5e7eb", fontSize: 14, fontWeight: "500" },
  btn: { backgroundColor: "#dc2626", borderRadius: 8, padding: 10, marginTop: 12, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  infoText: { color: "#9ca3af", fontSize: 13, lineHeight: 20 },
});
