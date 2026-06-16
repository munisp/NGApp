import React from "react";
import { View, Text, ScrollView, StyleSheet, Switch, Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { api } from "../services/api";

export function SettingsHomeScreen() {
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [offlineMode, setOfflineMode] = React.useState(true);

  const pushMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (enabled) {
        await api.init();
        Alert.alert("Push Notifications", "Enabled");
      } else {
        Alert.alert("Push Notifications", "Disabled");
      }
    },
  });

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Settings</Text>
      <View style={s.card}>
        <Text style={s.sectionTitle}>Notifications</Text>
        <View style={s.settingRow}>
          <View><Text style={s.settingLabel}>Push Notifications</Text><Text style={s.settingDesc}>Receive alerts for breaches and SLA deadlines</Text></View>
          <Switch value={pushEnabled} onValueChange={(v) => { setPushEnabled(v); pushMutation.mutate(v); }} trackColor={{ true: "#3b82f6" }} />
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.sectionTitle}>Security</Text>
        <View style={s.settingRow}>
          <View><Text style={s.settingLabel}>Biometric Login</Text><Text style={s.settingDesc}>Use Face ID / fingerprint to authenticate</Text></View>
          <Switch value={biometricEnabled} onValueChange={setBiometricEnabled} trackColor={{ true: "#3b82f6" }} />
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.sectionTitle}>Data</Text>
        <View style={s.settingRow}>
          <View><Text style={s.settingLabel}>Offline Mode</Text><Text style={s.settingDesc}>Queue actions when offline, sync when connected</Text></View>
          <Switch value={offlineMode} onValueChange={setOfflineMode} trackColor={{ true: "#3b82f6" }} />
        </View>
        <Text style={s.queueInfo}>Offline queue: {api.getOfflineQueueSize()} items</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 16 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 16 },
  sectionTitle: { color: "#3b82f6", fontSize: 14, fontWeight: "700", marginBottom: 12, textTransform: "uppercase" },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  settingLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
  settingDesc: { color: "#9ca3af", fontSize: 12, marginTop: 2, maxWidth: 250 },
  queueInfo: { color: "#6b7280", fontSize: 12, marginTop: 8 },
});
