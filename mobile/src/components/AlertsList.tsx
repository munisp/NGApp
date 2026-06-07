import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  timestamp: string;
}

interface Props {
  alerts: Alert[];
}

export function AlertsList({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <View style={styles.empty}>
        <Feather name="check-circle" size={24} color="#10b981" />
        <Text style={styles.emptyText}>No active alerts</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {alerts.map((alert) => (
        <TouchableOpacity key={alert.id} style={styles.alertItem}>
          <View style={[styles.severityDot, { backgroundColor: severityColor(alert.severity) }]} />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
            <Text style={styles.alertMeta}>{alert.type} · {formatTime(alert.timestamp)}</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#6b7280" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#f59e0b";
    default: return "#6b7280";
  }
}

function formatTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  empty: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText: { color: "#6b7280", fontSize: 14 },
  alertItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#1f2937", borderRadius: 12, padding: 14, gap: 12 },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  alertContent: { flex: 1 },
  alertTitle: { color: "#ffffff", fontSize: 14, fontWeight: "500" },
  alertMeta: { color: "#6b7280", fontSize: 12, marginTop: 2 },
});
