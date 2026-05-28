/**
 * OSDU/WITSML/SAP Integrations — React Native Screen (v42)
 */
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";

export default function IntegrationsScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ osdu: 0, witsml: 0, opcua: 0, cmms: 0 });

  useEffect(() => {
    setTimeout(() => {
      setStats({ osdu: 24, witsml: 18, opcua: 312, cmms: 7 });
      setLoading(false);
    }, 500);
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f59e0b" /></View>;

  const integrations = [
    { name: "OSDU R3", desc: "Open Subsurface Data Universe", count: stats.osdu, unit: "datasets", color: "#3b82f6" },
    { name: "WITSML 2.0", desc: "Well Information Transfer Markup Language", count: stats.witsml, unit: "wells", color: "#22c55e" },
    { name: "OPC-UA Server", desc: "Industrial Automation Protocol", count: stats.opcua, unit: "nodes", color: "#f59e0b" },
    { name: "SAP PM / Maximo", desc: "CMMS Work Order Integration", count: stats.cmms, unit: "work orders", color: "#a855f7" },
  ];

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Integrations</Text>
        <Text style={s.subtitle}>OSDU · WITSML · PRODML · OPC-UA · SAP/Maximo</Text>
      </View>
      {integrations.map((intg) => (
        <View key={intg.name} style={s.card}>
          <View style={[s.colorBar, { backgroundColor: intg.color }]} />
          <View style={s.cardBody}>
            <Text style={s.cardTitle}>{intg.name}</Text>
            <Text style={s.cardDesc}>{intg.desc}</Text>
            <Text style={[s.cardCount, { color: intg.color }]}>{intg.count} {intg.unit}</Text>
          </View>
        </View>
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
  card: { backgroundColor: "#161b22", marginHorizontal: 12, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: "#30363d", flexDirection: "row", overflow: "hidden" },
  colorBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTitle: { fontSize: 15, color: "#e6edf3", fontWeight: "700" },
  cardDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cardCount: { fontSize: 20, fontWeight: "bold", marginTop: 6 },
});
