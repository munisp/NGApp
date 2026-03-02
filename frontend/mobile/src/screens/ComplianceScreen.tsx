import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";
import { useKYCApplications, useKYBApplications, useKYCStats } from "../hooks/useApi";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

const STATUS_COLORS: Record<string, string> = {
  approved: colors.up,
  under_review: colors.warning,
  rejected: colors.down,
  pending: colors.info,
  processing: colors.info,
  liveness_complete: colors.brand.primary,
  document_uploaded: colors.purple,
};

const STATUS_ICONS: Record<string, IconName> = {
  approved: "check",
  under_review: "clock",
  rejected: "x",
  pending: "clock",
  processing: "refresh",
  liveness_complete: "eye",
  document_uploaded: "upload",
};

export default function ComplianceScreen() {
  const [tab, setTab] = useState<"kyc" | "kyb" | "stats">("stats");
  const { data: kycData, loading: kycLoading } = useKYCApplications();
  const { data: kybData, loading: kybLoading } = useKYBApplications();
  const { data: statsData, loading: statsLoading } = useKYCStats();

  const kycApps = ((kycData as Record<string, unknown>)?.applications ?? kycData ?? []) as Record<string, unknown>[];
  const kybApps = ((kybData as Record<string, unknown>)?.applications ?? kybData ?? []) as Record<string, unknown>[];
  const stats = ((statsData as Record<string, unknown>)?.stats ?? statsData ?? {}) as Record<string, unknown>;

  const loading = kycLoading || kybLoading || statsLoading;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Compliance</Text>
          <Text style={styles.subtitle}>KYC/KYB application management</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(["stats", "kyc", "kyb"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "stats" ? "Overview" : t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "stats" && (
          <View style={styles.section}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total KYC</Text>
                <Text style={styles.statValue}>{(stats.total_kyc as number) ?? 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total KYB</Text>
                <Text style={styles.statValue}>{(stats.total_kyb as number) ?? 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Pending Review</Text>
                <Text style={[styles.statValue, { color: colors.warning }]}>{(stats.pending_review as number) ?? 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Rejection Rate</Text>
                <Text style={[styles.statValue, { color: colors.down }]}>{(stats.rejection_rate as number) ?? 0}%</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg Processing</Text>
                <Text style={styles.statValue}>{(stats.avg_processing_time as string) ?? "N/A"}</Text>
              </View>
            </View>
          </View>
        )}

        {tab === "kyc" && kycApps.map((app) => {
          const status = (app.status as string) || "pending";
          const statusColor = STATUS_COLORS[status] || colors.text.muted;
          const statusIcon = STATUS_ICONS[status] || "clock";
          return (
            <View key={app.id as string} style={styles.appCard}>
              <View style={styles.appHeader}>
                <View style={[styles.iconBg, { backgroundColor: statusColor + "20" }]}>
                  <Icon name={statusIcon} size={16} color={statusColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>{app.full_name as string}</Text>
                  <Text style={styles.appEmail}>{app.email as string}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{status.replace("_", " ")}</Text>
                </View>
              </View>
              <View style={styles.appMeta}>
                <Text style={styles.appMetaText}>Type: {(app.stakeholder_type as string || "").replace("_", " ")}</Text>
                <Text style={styles.appMetaText}>Risk: {app.risk_level as string}</Text>
              </View>
            </View>
          );
        })}

        {tab === "kyb" && kybApps.map((app) => {
          const status = (app.status as string) || "pending";
          const statusColor = STATUS_COLORS[status] || colors.text.muted;
          const statusIcon = STATUS_ICONS[status] || "clock";
          return (
            <View key={app.id as string} style={styles.appCard}>
              <View style={styles.appHeader}>
                <View style={[styles.iconBg, { backgroundColor: statusColor + "20" }]}>
                  <Icon name={statusIcon} size={16} color={statusColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>{app.business_name as string}</Text>
                  <Text style={styles.appEmail}>Reg: {app.registration_number as string}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{status.replace("_", " ")}</Text>
                </View>
              </View>
              <View style={styles.appMeta}>
                <Text style={styles.appMetaText}>Type: {(app.stakeholder_type as string || "").replace("_", " ")}</Text>
                <Text style={styles.appMetaText}>Industry: {app.industry as string}</Text>
              </View>
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  tabRow: { flexDirection: "row", paddingHorizontal: spacing.xl, marginTop: spacing.lg, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.bg.card, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  tabText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.muted },
  tabTextActive: { color: colors.white },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { width: "47%", backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  statValue: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary, marginTop: 4 },
  appCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  appHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 38, height: 38, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  appName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  appEmail: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  statusText: { fontSize: fontSize.xs, fontWeight: "700", textTransform: "capitalize" },
  appMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  appMetaText: { fontSize: fontSize.xs, color: colors.text.muted, textTransform: "capitalize" },
});
