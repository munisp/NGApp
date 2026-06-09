import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { api } from "../services/api";

export function AlertDetailScreen({ route, navigation }: { route: { params?: { alertId?: string } }; navigation: { goBack: () => void } }) {
  const alertId = route.params?.alertId ?? "—";
  const [acknowledged, setAcknowledged] = React.useState(false);

  const handleAcknowledge = async () => {
    try {
      await api.acknowledgeAlert(alertId);
      setAcknowledged(true);
      Alert.alert("Alert Acknowledged", "This alert has been acknowledged and assigned to you.");
    } catch {
      Alert.alert("Error", "Failed to acknowledge alert. Will retry when online.");
    }
  };

  return (
    <ScrollView style={s.container}>
      <View style={s.header}><Text style={s.title}>Alert #{alertId}</Text></View>
      <View style={s.card}>
        <Text style={s.label}>Type</Text><Text style={s.value}>Security Alert</Text>
        <Text style={s.label}>Severity</Text><Text style={[s.value, { color: "#ef4444" }]}>Critical</Text>
        <Text style={s.label}>Source</Text><Text style={s.value}>WAF / OpenAppSec</Text>
        <Text style={s.label}>Detected At</Text><Text style={s.value}>{new Date().toLocaleString()}</Text>
        <Text style={s.label}>Description</Text>
        <Text style={s.desc}>Anomalous traffic pattern detected from IP range. Potential DDoS or data exfiltration attempt. WAF rules triggered on /api/v2/compliance/* endpoints.</Text>
      </View>
      <TouchableOpacity style={[s.ackBtn, acknowledged && s.ackBtnDone]} onPress={handleAcknowledge} disabled={acknowledged}>
        <Text style={s.ackText}>{acknowledged ? "Acknowledged" : "Acknowledge Alert"}</Text>
      </TouchableOpacity>
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
  desc: { color: "#d1d5db", fontSize: 14, lineHeight: 20, marginTop: 4 },
  ackBtn: { backgroundColor: "#f59e0b", borderRadius: 8, padding: 14, marginHorizontal: 16, alignItems: "center" },
  ackBtnDone: { backgroundColor: "#10b981" },
  ackText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
