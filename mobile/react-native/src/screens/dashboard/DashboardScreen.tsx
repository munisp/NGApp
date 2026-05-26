/**
 * DashboardScreen — Main KPI overview for field operators.
 * Mirrors the PWA Overview page. Uses real tRPC data from:
 *   - trpc.overview.kpis (well counts, production totals, active alarms)
 *   - trpc.alarms.list (recent critical alarms)
 *   - trpc.wells.list (well status summary)
 */
import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { trpc } from "../../api/trpc";
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW } from "../../utils/theme";
import { useAuth } from "../../hooks/useAuth";

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: string;
  color: string;
  onPress?: () => void;
}

function KPICard({ title, value, unit, icon, color, onPress }: KPICardProps) {
  return (
    <TouchableOpacity
      style={[styles.kpiCard, SHADOW.sm]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.kpiIcon, { backgroundColor: color + "20" }]}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <Text style={styles.kpiValue}>
        {value}
        {unit && <Text style={styles.kpiUnit}> {unit}</Text>}
      </Text>
      <Text style={styles.kpiTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = trpc.overview.kpis.useQuery();
  const { data: alarmsData, refetch: refetchAlarms } = trpc.alarms.list.useQuery({ limit: 5, state: "ACTIVE" });
  const { data: wellsData, refetch: refetchWells } = trpc.wells.list.useQuery({ limit: 100 });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchKpis(), refetchAlarms(), refetchWells()]);
    setRefreshing(false);
  }, [refetchKpis, refetchAlarms, refetchWells]);

  const wells = wellsData?.wells ?? [];
  const alarms = alarmsData?.alarms ?? [];

  const producingCount = wells.filter((w: any) => w.status === "PRODUCING").length;
  const shutInCount = wells.filter((w: any) => w.status === "SHUT_IN").length;
  const workoverCount = wells.filter((w: any) => w.status === "WORKOVER").length;
  const criticalAlarms = alarms.filter((a: any) => a.severity === "CRITICAL").length;

  if (kpisLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading platform data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()}</Text>
          <Text style={styles.userName}>{user?.name ?? "Field Engineer"}</Text>
        </View>
        <View style={styles.headerRight}>
          {criticalAlarms > 0 && (
            <TouchableOpacity
              style={styles.alarmBadge}
              onPress={() => navigation.navigate("Alarms")}
            >
              <Icon name="bell-ring" size={18} color={COLORS.error} />
              <Text style={styles.alarmBadgeText}>{criticalAlarms}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Well Status KPIs */}
      <Text style={styles.sectionTitle}>Well Status</Text>
      <View style={styles.kpiGrid}>
        <KPICard
          title="Producing"
          value={producingCount}
          icon="oil"
          color={COLORS.wellProducing}
          onPress={() => navigation.navigate("Wells")}
        />
        <KPICard
          title="Shut-In"
          value={shutInCount}
          icon="pause-circle-outline"
          color={COLORS.wellShutIn}
          onPress={() => navigation.navigate("Wells")}
        />
        <KPICard
          title="Workover"
          value={workoverCount}
          icon="wrench-outline"
          color={COLORS.wellWorkover}
          onPress={() => navigation.navigate("Workovers")}
        />
        <KPICard
          title="Total Wells"
          value={wells.length}
          icon="map-marker-multiple-outline"
          color={COLORS.info}
          onPress={() => navigation.navigate("Wells")}
        />
      </View>

      {/* Production KPIs */}
      <Text style={styles.sectionTitle}>Today's Production</Text>
      <View style={styles.kpiGrid}>
        <KPICard
          title="Oil Rate"
          value={kpis?.totalOilRate?.toFixed(0) ?? "—"}
          unit="bbl/d"
          icon="water"
          color={COLORS.primary}
        />
        <KPICard
          title="Gas Rate"
          value={kpis?.totalGasRate?.toFixed(0) ?? "—"}
          unit="mscf/d"
          icon="gas-cylinder"
          color={COLORS.info}
        />
        <KPICard
          title="Water Cut"
          value={kpis?.avgWaterCut?.toFixed(1) ?? "—"}
          unit="%"
          icon="water-percent"
          color={COLORS.textSecondary}
        />
        <KPICard
          title="Uptime"
          value={kpis?.facilityUptime?.toFixed(1) ?? "—"}
          unit="%"
          icon="clock-check-outline"
          color={COLORS.success}
        />
      </View>

      {/* Active Alarms */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Alarms</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Alarms")}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {alarms.length === 0 ? (
        <View style={styles.emptyCard}>
          <Icon name="check-circle-outline" size={32} color={COLORS.success} />
          <Text style={styles.emptyText}>No active alarms</Text>
        </View>
      ) : (
        alarms.slice(0, 5).map((alarm: any) => (
          <TouchableOpacity
            key={alarm.id}
            style={[styles.alarmRow, SHADOW.sm]}
            onPress={() => navigation.navigate("Alarms")}
          >
            <View style={[styles.alarmSeverityDot, { backgroundColor: getSeverityColor(alarm.severity) }]} />
            <View style={styles.alarmContent}>
              <Text style={styles.alarmTitle} numberOfLines={1}>{alarm.message}</Text>
              <Text style={styles.alarmMeta}>{alarm.wellName} · {alarm.severity}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL": return COLORS.alarmCritical;
    case "HIGH": return COLORS.alarmHigh;
    case "MEDIUM": return COLORS.alarmMedium;
    case "LOW": return COLORS.alarmLow;
    default: return COLORS.alarmInfo;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary, fontSize: FONT_SIZE.md },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg },
  greeting: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  userName: { fontSize: FONT_SIZE.xl, fontWeight: "700", color: COLORS.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  alarmBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.error + "20", paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  alarmBadgeText: { color: COLORS.error, fontSize: FONT_SIZE.sm, fontWeight: "700" },

  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: "600", color: COLORS.text, marginBottom: SPACING.sm, marginTop: SPACING.md },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: SPACING.md, marginBottom: SPACING.sm },
  seeAll: { fontSize: FONT_SIZE.sm, color: COLORS.primary },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.sm },
  kpiCard: { flex: 1, minWidth: "45%", backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, gap: SPACING.xs },
  kpiIcon: { width: 40, height: 40, borderRadius: BORDER_RADIUS.md, justifyContent: "center", alignItems: "center" },
  kpiValue: { fontSize: FONT_SIZE.xxl, fontWeight: "700", color: COLORS.text },
  kpiUnit: { fontSize: FONT_SIZE.sm, fontWeight: "400", color: COLORS.textSecondary },
  kpiTitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  alarmRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm },
  alarmSeverityDot: { width: 10, height: 10, borderRadius: 5 },
  alarmContent: { flex: 1 },
  alarmTitle: { fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: "500" },
  alarmMeta: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },

  emptyCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, alignItems: "center", gap: SPACING.sm },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
});
