import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";

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

const typeIcons: Record<string, string> = {
  trade: "📈",
  alert: "🔔",
  margin: "⚠️",
  system: "🔧",
  kyc: "🛡",
};

const typeColors: Record<string, string> = {
  trade: colors.brand.primary,
  alert: colors.warning,
  margin: colors.down,
  system: colors.text.muted,
  kyc: colors.brand.primary,
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
        <Text style={styles.unreadText}>{unread} unread</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.notifCard, !item.read && styles.unreadCard]}
            onPress={() => markRead(item.id)}
          >
            <View style={styles.notifLeft}>
              <View style={[styles.iconCircle, { backgroundColor: typeColors[item.type] + "20" }]}>
                <Text style={styles.icon}>{typeIcons[item.type]}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <View style={styles.notifContent}>
              <View style={styles.notifHeader}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifTime}>{item.timestamp}</Text>
              </View>
              <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No notifications</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  unreadText: { fontSize: fontSize.sm, color: colors.text.muted },
  markAllText: { fontSize: fontSize.sm, color: colors.brand.primary, fontWeight: "600" },
  listContent: { paddingVertical: spacing.sm },
  notifCard: { flexDirection: "row", paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  unreadCard: { backgroundColor: "rgba(22, 163, 74, 0.03)" },
  notifLeft: { position: "relative", marginRight: spacing.md },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 18 },
  unreadDot: { position: "absolute", top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand.primary, borderWidth: 2, borderColor: colors.bg.primary },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  notifTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text.primary },
  notifTime: { fontSize: fontSize.xs, color: colors.text.muted },
  notifMessage: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 4, lineHeight: 18 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { fontSize: fontSize.md, color: colors.text.muted },
});
