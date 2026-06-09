import React from "react";
import { View, Text, ScrollView, StyleSheet, Switch } from "react-native";

const NOTIFICATION_TYPES = [
  { key: "breach", label: "Breach Alerts", desc: "72-hour NDPC notification deadlines", enabled: true },
  { key: "enforcement", label: "Enforcement Updates", desc: "Case status changes, penalty decisions", enabled: true },
  { key: "compliance", label: "Compliance Reminders", desc: "Annual audit deadlines, expiring certifications", enabled: true },
  { key: "noc", label: "NOC Alerts", desc: "Service health, downtime, performance", enabled: true },
  { key: "regulatory", label: "Regulatory Changes", desc: "New NDPC guidelines, CBN circulars", enabled: false },
  { key: "dsar", label: "DSAR Updates", desc: "Data subject access request status", enabled: false },
];

export function NotificationsScreen() {
  const [settings, setSettings] = React.useState(
    Object.fromEntries(NOTIFICATION_TYPES.map(n => [n.key, n.enabled]))
  );

  const toggle = (key: string) => setSettings(s => ({ ...s, [key]: !s[key] }));

  return (
    <ScrollView style={s.container}>
      <View style={s.header}><Text style={s.title}>Notifications</Text><Text style={s.subtitle}>Manage push notification preferences</Text></View>
      {NOTIFICATION_TYPES.map(nt => (
        <View key={nt.key} style={s.item}>
          <View style={{ flex: 1 }}>
            <Text style={s.itemLabel}>{nt.label}</Text>
            <Text style={s.itemDesc}>{nt.desc}</Text>
          </View>
          <Switch value={settings[nt.key]} onValueChange={() => toggle(nt.key)} trackColor={{ true: "#10b981" }} />
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginTop: 4 },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1f2937" },
  itemLabel: { color: "#e5e7eb", fontSize: 16, fontWeight: "500" },
  itemDesc: { color: "#6b7280", fontSize: 13, marginTop: 2 },
});
