/**
 * NDSEP Mobile — Dashboard Screen
 * Full parity with web compliance dashboard.
 * Shows real-time compliance scores, alerts, and enforcement status.
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { api } from "../services/api";
import { ComplianceScoreCard } from "../components/ComplianceScoreCard";
import { AlertsList } from "../components/AlertsList";
import { QuickActions } from "../components/QuickActions";
import { MetricsGrid } from "../components/MetricsGrid";

const { width } = Dimensions.get("window");

export function DashboardScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: complianceData, refetch: refetchCompliance } = useQuery({
    queryKey: ["compliance-overview"],
    queryFn: () => api.getComplianceOverview(),
    staleTime: 30_000,
  });

  const { data: alerts, refetch: refetchAlerts } = useQuery({
    queryKey: ["active-alerts"],
    queryFn: () => api.getActiveAlerts(),
    staleTime: 10_000,
  });

  const { data: metrics } = useQuery({
    queryKey: ["platform-metrics"],
    queryFn: () => api.getPlatformMetrics(),
    staleTime: 60_000,
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchCompliance(), refetchAlerts()]);
    setRefreshing(false);
  }, [refetchCompliance, refetchAlerts]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>NDSEP Dashboard</Text>
        <Text style={styles.subtitle}>National Data Sovereignty Enforcement</Text>
      </View>

      {/* Compliance Score */}
      <ComplianceScoreCard
        score={complianceData?.overallScore ?? 0}
        trend={complianceData?.trend ?? "stable"}
        dimensions={complianceData?.dimensions ?? {}}
      />

      {/* Quick Actions */}
      <QuickActions
        actions={[
          { label: "New Breach", icon: "alert-circle", onPress: () => navigation.navigate("BreachReport" as never) },
          { label: "DSAR", icon: "file-text", onPress: () => navigation.navigate("DSARSubmit" as never) },
          { label: "Audit", icon: "shield", onPress: () => navigation.navigate("AuditTrail" as never) },
          { label: "NOC", icon: "activity", onPress: () => navigation.navigate("NOCMonitor" as never) },
        ]}
      />

      {/* Key Metrics */}
      <MetricsGrid
        metrics={[
          { label: "Organizations", value: metrics?.totalOrgs ?? 0, icon: "building" },
          { label: "Active Cases", value: metrics?.activeCases ?? 0, icon: "briefcase" },
          { label: "Breaches (30d)", value: metrics?.breaches30d ?? 0, icon: "alert-triangle" },
          { label: "Compliance Avg", value: `${metrics?.avgCompliance ?? 0}%`, icon: "bar-chart" },
        ]}
      />

      {/* Active Alerts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Alerts</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Alerts" as never)}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        <AlertsList alerts={alerts?.slice(0, 5) ?? []} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  viewAll: {
    fontSize: 14,
    color: "#10b981",
  },
});
