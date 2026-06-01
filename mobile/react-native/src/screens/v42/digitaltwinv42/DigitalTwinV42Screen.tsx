/**
 * 3D Digital Twin v42 — React Native Screen (v42)
 * Shows twin models list and FPSO pixel streaming sessions
 */
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";

export default function DigitalTwinV42Screen() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<{ id: number; modelId: string; name: string; assetType: string; isActive: boolean }[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setModels([
        { id: 1, modelId: "DT-WELL001", name: "Well ALPHA-001 Digital Twin", assetType: "wellhead", isActive: true },
        { id: 2, modelId: "DT-FPSO001", name: "FPSO Titan Digital Twin", assetType: "fpso", isActive: true },
        { id: 3, modelId: "DT-COMP001", name: "Compressor Train A", assetType: "compressor", isActive: true },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f59e0b" /></View>;

  const ASSET_COLOR: Record<string, string> = { wellhead: "#22c55e", fpso: "#3b82f6", compressor: "#f59e0b" };

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>3D Digital Twin</Text>
        <Text style={s.subtitle}>Three.js + Unreal Engine Pixel Streaming</Text>
      </View>
      <View style={s.infoBox}>
        <Text style={s.infoText}>3D rendering is available in the web PWA. Mobile shows model list and sensor bindings.</Text>
      </View>
      <Text style={s.section}>Twin Models ({models.length})</Text>
      {models.map((m) => (
        <TouchableOpacity key={m.id} style={s.row}>
          <View style={[s.assetIcon, { backgroundColor: (ASSET_COLOR[m.assetType] ?? "#6b7280") + "22" }]}>
            <Text style={{ fontSize: 18 }}>{m.assetType === "fpso" ? "🛢️" : m.assetType === "wellhead" ? "⛽" : "⚙️"}</Text>
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowTitle}>{m.name}</Text>
            <Text style={s.rowMeta}>{m.modelId} · {m.assetType}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: m.isActive ? "#22c55e22" : "#6b728022", borderColor: m.isActive ? "#22c55e" : "#6b7280" }]}>
            <Text style={[s.badgeText, { color: m.isActive ? "#22c55e" : "#6b7280" }]}>{m.isActive ? "active" : "inactive"}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1117" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0d1117" },
  header: { padding: 20, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f59e0b" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  infoBox: { backgroundColor: "#1e3a5f", marginHorizontal: 12, marginBottom: 8, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#3b82f6" },
  infoText: { fontSize: 12, color: "#93c5fd" },
  section: { fontSize: 16, fontWeight: "600", color: "#e6edf3", paddingHorizontal: 16, paddingVertical: 8 },
  row: { backgroundColor: "#161b22", marginHorizontal: 12, marginBottom: 8, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "#30363d", flexDirection: "row", alignItems: "center" },
  assetIcon: { width: 40, height: 40, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 12 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 13, color: "#e6edf3", fontWeight: "600" },
  rowMeta: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "600" },
});
