import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

interface NotificationItem {
  id: string;
  type: "trade" | "alert" | "margin" | "system" | "kyc";
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}

const initialNotifications: NotificationItem[] = [
  { id: "1", type: "trade", title: "Order Filled", message: "Your BUY order for 20 COFFEE at 4,518.50 has been filled", read: false, timestamp: "10 min ago" },
  { id: "2", type: "alert", title: "Price Alert", message: "CRUDE_OIL has crossed above $78.00", read: false, timestamp: "30 min ago" },
  { id: "3", type: "margin", title: "Margin Warning", message: "Your margin utilization is at 75%. Consider reducing positions.", read: false, timestamp: "2h ago" },
  { id: "4", type: "system", title: "Maintenance Window", message: "Scheduled maintenance on Feb 28 from 02:00-04:00 UTC", read: true, timestamp: "Yesterday" },
  { id: "5", type: "kyc", title: "KYC Verified", message: "Your identity verification is complete. Full trading access enabled.", read: true, timestamp: "6 days ago" },
  { id: "6", type: "trade", title: "Settlement Complete", message: "Trade trd-003 MAIZE settlement has been finalized on-chain", read: true, timestamp: "1 week ago" },
  { id: "7", type: "alert", title: "Price Alert", message: "GOLD dropped below $2,340.00", read: true, timestamp: "1 week ago" },
];

const typeIcons: Record<string, IconName> = {
  trade: "trending-up",
  alert: "bell",
  margin: "alert-triangle",
  system: "settings",
  kyc: "shield",
};

const typeColors: Record<string, string> = {
  trade: colors.brand.primary,
  alert: colors.warning,
  margin: colors.down,
  system: colors.text.muted,
  kyc: colors.info,
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications(notifications.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unread}</Text>
          </View>
          <Text style={styles.unreadText}>unread notifications</Text>
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllButton} activeOpacity={0.7}>
            <Icon name="check" size={14} color={colors.brand.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const iconName = typeIcons[item.type] || "bell";
          const iconColor = typeColors[item.type] || colors.text.muted;
          return (
            <TouchableOpacity
              style={[styles.notifCard, !item.read && styles.unreadCard]}
              onPress={() => markRead(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.notifLeft}>
                <View style={[styles.iconCircle, { backgroundColor: iconColor + "18" }]}>
                  <Icon name={iconName} size={18} color={iconColor} />
                </View>
                {!item.read && <View style={styles.unreadDot} />}
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifHeader}>
                  <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>{item.title}</Text>
                  <View style={styles.timeRow}>
                    <Icon name="clock" size={10} color={colors.text.muted} />
                    <Text style={styles.notifTime}>{item.timestamp}</Text>
                  </View>
                </View>
                <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
                <View style={[styles.typeBadge, { backgroundColor: iconColor + "12" }]}>
                  <Text style={[styles.typeBadgeText, { color: iconColor }]}>{item.type.toUpperCase()}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <Icon name="bell-off" size={32} color={colors.text.muted} />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>No notifications at this time</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  unreadBadge: { backgroundColor: colors.brand.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  unreadBadgeText: { fontSize: 11, fontWeight: "800", color: colors.white },
  unreadText: { fontSize: fontSize.sm, color: colors.text.muted },
  markAllButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(16, 185, 129, 0.08)", borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  markAllText: { fontSize: fontSize.sm, color: colors.brand.primary, fontWeight: "700" },
  listContent: { paddingVertical: spacing.sm },
  notifCard: { flexDirection: "row", paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  unreadCard: { backgroundColor: "rgba(16, 185, 129, 0.03)" },
  notifLeft: { position: "relative", marginRight: spacing.md },
  iconCircle: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  unreadDot: { position: "absolute", top: -1, right: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand.primary, borderWidth: 2, borderColor: colors.bg.primary },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  notifTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text.primary, flex: 1 },
  notifTitleUnread: { fontWeight: "700" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: spacing.sm },
  notifTime: { fontSize: fontSize.xs, color: colors.text.muted },
  notifMessage: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 4, lineHeight: 20 },
  typeBadge: { alignSelf: "flex-start", borderRadius: borderRadius.xs, paddingHorizontal: spacing.sm, paddingVertical: 2, marginTop: spacing.sm },
  typeBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  separator: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.xl },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyIconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.bg.card, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  emptyText: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 4 },
});
