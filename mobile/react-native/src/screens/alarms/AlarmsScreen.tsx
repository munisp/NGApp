/**
 * AlarmsScreen — Active alarm list with acknowledge/resolve actions.
 * Uses trpc.alarms.list, trpc.alarms.acknowledge, trpc.alarms.resolve.
 * Supports filter by severity and state. Pull-to-refresh.
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { trpc } from "../../api/trpc";
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW } from "../../utils/theme";
import { formatDistanceToNow } from "date-fns";

const SEVERITY_FILTERS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATE_FILTERS = ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"];

export default function AlarmsScreen() {
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ACTIVE");
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = trpc.alarms.list.useQuery({
    limit: 100,
    severity: severityFilter === "ALL" ? undefined : severityFilter as any,
    state: stateFilter as any,
  });

  const utils = trpc.useUtils();

  const acknowledge = trpc.alarms.acknowledge.useMutation({
    onSuccess: () => utils.alarms.list.invalidate(),
    onError: (err) => Alert.alert("Error", err.message),
  });

  const resolve = trpc.alarms.resolve.useMutation({
    onSuccess: () => utils.alarms.list.invalidate(),
    onError: (err) => Alert.alert("Error", err.message),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const alarms = data?.alarms ?? [];

  function getSeverityColor(severity: string): string {
    switch (severity) {
      case "CRITICAL": return COLORS.alarmCritical;
      case "HIGH": return COLORS.alarmHigh;
      case "MEDIUM": return COLORS.alarmMedium;
      case "LOW": return COLORS.alarmLow;
      default: return COLORS.alarmInfo;
    }
  }

  function handleAcknowledge(alarmId: string) {
    Alert.alert("Acknowledge Alarm", "Mark this alarm as acknowledged?", [
      { text: "Cancel", style: "cancel" },
      { text: "Acknowledge", onPress: () => acknowledge.mutate({ alarmId, note: "Acknowledged via mobile" }) },
    ]);
  }

  function handleResolve(alarmId: string) {
    Alert.alert("Resolve Alarm", "Mark this alarm as resolved?", [
      { text: "Cancel", style: "cancel" },
      { text: "Resolve", style: "destructive", onPress: () => resolve.mutate({ alarmId, resolution: "Resolved via mobile" }) },
    ]);
  }

  function renderAlarm({ item }: { item: any }) {
    const severityColor = getSeverityColor(item.severity);
    const timeAgo = item.triggeredAt
      ? formatDistanceToNow(new Date(item.triggeredAt), { addSuffix: true })
      : "Unknown time";

    return (
      <View style={[styles.alarmCard, SHADOW.sm, { borderLeftColor: severityColor, borderLeftWidth: 3 }]}>
        <View style={styles.alarmHeader}>
          <View style={styles.alarmTitleRow}>
            <View style={[styles.severityBadge, { backgroundColor: severityColor + "20" }]}>
              <Text style={[styles.severityText, { color: severityColor }]}>{item.severity}</Text>
            </View>
            <Text style={styles.alarmState}>{item.state}</Text>
          </View>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>

        <Text style={styles.alarmMessage}>{item.message}</Text>
        <Text style={styles.alarmMeta}>{item.wellName ?? "Unknown well"} · {item.tag ?? "—"}</Text>

        {item.state === "ACTIVE" && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.ackBtn}
              onPress={() => handleAcknowledge(item.id)}
              disabled={acknowledge.isPending}
            >
              <Icon name="check" size={14} color={COLORS.warning} />
              <Text style={styles.ackBtnText}>Acknowledge</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resolveBtn}
              onPress={() => handleResolve(item.id)}
              disabled={resolve.isPending}
            >
              <Icon name="check-all" size={14} color={COLORS.success} />
              <Text style={styles.resolveBtnText}>Resolve</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* State filter */}
      <View style={styles.stateFilterRow}>
        {STATE_FILTERS.map((state) => (
          <TouchableOpacity
            key={state}
            style={[styles.stateChip, stateFilter === state && styles.stateChipActive]}
            onPress={() => setStateFilter(state)}
          >
            <Text style={[styles.stateChipText, stateFilter === state && styles.stateChipTextActive]}>
              {state}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Severity filter */}
      <FlatList
        horizontal
        data={SEVERITY_FILTERS}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: sev }) => (
          <TouchableOpacity
            style={[styles.filterChip, severityFilter === sev && styles.filterChipActive]}
            onPress={() => setSeverityFilter(sev)}
          >
            <Text style={[styles.filterChipText, severityFilter === sev && styles.filterChipTextActive]}>{sev}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Alarm count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{alarms.length} alarm{alarms.length !== 1 ? "s" : ""}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={alarms}
          keyExtractor={(a) => a.id}
          renderItem={renderAlarm}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="bell-off-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No {stateFilter.toLowerCase()} alarms</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  stateFilterRow: { flexDirection: "row", padding: SPACING.md, gap: SPACING.sm },
  stateChip: { flex: 1, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.surface, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  stateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stateChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: "500" },
  stateChipTextActive: { color: "#fff", fontWeight: "700" },
  filterRow: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.sm },
  filterChip: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  filterChipTextActive: { color: "#fff", fontWeight: "600" },
  countRow: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  countText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  listContent: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 100 },
  alarmCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  alarmHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  alarmTitleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  severityBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm },
  severityText: { fontSize: FONT_SIZE.xs, fontWeight: "700" },
  alarmState: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  timeAgo: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  alarmMessage: { fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: "500" },
  alarmMeta: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  actionRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.xs },
  ackBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.warning + "15", borderWidth: 1, borderColor: COLORS.warning + "40" },
  ackBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.warning, fontWeight: "600" },
  resolveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.success + "15", borderWidth: 1, borderColor: COLORS.success + "40" },
  resolveBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.success, fontWeight: "600" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", paddingTop: 80, gap: SPACING.md },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
});
