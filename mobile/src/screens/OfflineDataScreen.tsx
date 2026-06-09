import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { syncEngine as OfflineSyncManager } from "../services/offlineSync";

export function OfflineDataScreen() {
  const [pendingCount, setPendingCount] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    OfflineSyncManager.getPendingCount().then(setPendingCount).catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await OfflineSyncManager.triggerSync();
      const count = await OfflineSyncManager.getPendingCount();
      setPendingCount(count);
      Alert.alert("Sync Complete", `${pendingCount - count} items synced successfully.`);
    } catch {
      Alert.alert("Sync Failed", "Some items could not be synced. They will retry automatically.");
    }
    setSyncing(false);
  };

  return (
    <ScrollView style={s.container}>
      <View style={s.header}><Text style={s.title}>Offline Data</Text><Text style={s.subtitle}>SQLite-backed offline storage with vector clock sync</Text></View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Sync Status</Text>
        <View style={s.statRow}>
          <View style={s.stat}><Text style={s.statValue}>{pendingCount}</Text><Text style={s.statLabel}>Pending</Text></View>
          <View style={s.stat}><Text style={s.statValue}>—</Text><Text style={s.statLabel}>Last Sync</Text></View>
        </View>
        <TouchableOpacity style={[s.syncBtn, syncing && { opacity: 0.5 }]} onPress={handleSync} disabled={syncing || pendingCount === 0}>
          <Text style={s.syncText}>{syncing ? "Syncing…" : "Sync Now"}</Text>
        </TouchableOpacity>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Cached Data</Text>
        {["Compliance Overview", "Active Alerts", "Platform Metrics", "NOC Status", "Enforcement Cases"].map((item, i) => (
          <View key={i} style={s.cacheItem}>
            <Text style={s.cacheName}>{item}</Text>
            <Text style={s.cacheStatus}>Cached</Text>
          </View>
        ))}
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Storage</Text>
        <Text style={s.infoText}>Local database uses SQLite with vector clocks for conflict resolution. All cached data expires after 24 hours. Mutations are queued and synced when connectivity returns.</Text>
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
  cardTitle: { color: "#d1d5db", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  statRow: { flexDirection: "row", gap: 20, marginVertical: 8 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: "#10b981", fontSize: 28, fontWeight: "800" },
  statLabel: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  syncBtn: { backgroundColor: "#10b981", borderRadius: 8, padding: 12, marginTop: 8, alignItems: "center" },
  syncText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cacheItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1f2937" },
  cacheName: { color: "#e5e7eb", fontSize: 14 },
  cacheStatus: { color: "#10b981", fontSize: 13, fontWeight: "600" },
  infoText: { color: "#9ca3af", fontSize: 13, lineHeight: 20 },
});
