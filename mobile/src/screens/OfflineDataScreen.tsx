import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { api } from "../services/api";

export function OfflineDataScreen() {
  const queueSize = api.getOfflineQueueSize();
  const syncMutation = useMutation({
    mutationFn: () => api.syncOfflineQueue(),
    onSuccess: (results) => { const synced = results.filter((r: any) => r.success).length; Alert.alert("Sync Complete", `${synced}/${results.length} items synced`); },
    onError: () => Alert.alert("Sync Failed", "Could not reach the server"),
  });

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Offline Data</Text>
      <Text style={s.subtitle}>Queued actions waiting to sync</Text>
      <View style={s.card}>
        <Text style={s.statNum}>{queueSize}</Text>
        <Text style={s.statLabel}>Items in offline queue</Text>
      </View>
      <TouchableOpacity style={[s.btn, queueSize === 0 && s.btnDisabled]} onPress={() => queueSize > 0 && syncMutation.mutate()} disabled={queueSize === 0}>
        <Text style={s.btnText}>{syncMutation.isPending ? "Syncing..." : "Sync Now"}</Text>
      </TouchableOpacity>
      <View style={s.info}>
        <Text style={s.infoTitle}>How it works</Text>
        <Text style={s.infoText}>When you submit breach reports or DSARs offline, they are saved locally and synced when connectivity is restored.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 24, alignItems: "center", marginBottom: 16 },
  statNum: { color: "#3b82f6", fontSize: 48, fontWeight: "700" },
  statLabel: { color: "#9ca3af", fontSize: 14, marginTop: 4 },
  btn: { backgroundColor: "#3b82f6", borderRadius: 8, padding: 14, alignItems: "center", marginBottom: 16 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  info: { backgroundColor: "#111827", borderRadius: 8, padding: 16 },
  infoTitle: { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  infoText: { color: "#9ca3af", fontSize: 13, lineHeight: 20 },
});
