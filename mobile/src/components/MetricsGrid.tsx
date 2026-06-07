import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

interface Metric {
  label: string;
  value: string | number;
  icon: string;
}

interface Props {
  metrics: Metric[];
}

export function MetricsGrid({ metrics }: Props) {
  return (
    <View style={styles.grid}>
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.card}>
          <Feather name={metric.icon as any} size={16} color="#6b7280" />
          <Text style={styles.value}>{metric.value}</Text>
          <Text style={styles.label}>{metric.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, marginTop: 20, gap: 8 },
  card: { width: "47%", backgroundColor: "#111827", borderRadius: 12, padding: 16, gap: 4 },
  value: { color: "#ffffff", fontSize: 22, fontWeight: "700" },
  label: { color: "#6b7280", fontSize: 11 },
});
