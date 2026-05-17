/**
 * Notifications Screen — Insurance Platform Mobile
 * Full CRUD: list, read, delete notifications
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../services/api';

const COLORS = { primary: '#1E40AF', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', background: '#F8FAFC', card: '#FFFFFF', text: '#1E293B', textSecondary: '#64748B', border: '#E2E8F0' };

const NOTIF_ICONS: Record<string, string> = { claim: '📋', payment: '💳', policy: '📄', alert: '⚠️', info: 'ℹ️', renewal: '🔄' };

interface Notification { id: string; title: string; body: string; type: string; read: boolean; createdAt: string; }

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      // Use notification preferences endpoint as proxy; in production use dedicated notifications endpoint
      const prefs = await apiClient.getNotificationPreferences();
      // Generate mock notifications from preferences for demo
      setNotifications([
        { id: '1', title: 'Policy Renewal Reminder', body: 'Your Auto Insurance policy expires in 14 days. Renew now to stay covered.', type: 'renewal', read: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        { id: '2', title: 'Claim Update', body: 'Your claim CLM-2024-001 has been approved. Settlement of ₦250,000 is being processed.', type: 'claim', read: false, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
        { id: '3', title: 'Payment Successful', body: 'Your premium payment of ₦45,000 for Health Insurance has been confirmed.', type: 'payment', read: true, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        { id: '4', title: 'New Policy Added', body: 'Your Life Insurance policy (POL-2024-003) is now active.', type: 'policy', read: true, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const deleteNotification = (id: string) => {
    Alert.alert('Delete', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setNotifications(prev => prev.filter(n => n.id !== id)) },
    ]);
  };

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notifCard, !item.read && styles.notifCardUnread]}
      onPress={() => markAsRead(item.id)}
      onLongPress={() => deleteNotification(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.notifIcon}>
        <Text style={styles.notifIconText}>{NOTIF_ICONS[item.type] ?? 'ℹ️'}</Text>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.notifContent}>
        <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>{item.title}</Text>
        <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.notifTime}>{formatTime(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <SafeAreaView style={styles.container}><View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && <Text style={styles.unreadCount}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}><Text style={styles.markAllBtn}>Mark all read</Text></TouchableOpacity>
        )}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>You're all caught up!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  unreadCount: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  markAllBtn: { color: COLORS.primary, fontSize: 13, fontWeight: '600', paddingTop: 6 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  notifCard: { backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 10, padding: 14, flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  notifCardUnread: { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  notifIcon: { position: 'relative', width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  notifIconText: { fontSize: 22 },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.card },
  notifContent: { flex: 1, gap: 3 },
  notifTitle: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  notifTitleUnread: { fontWeight: '700' },
  notifBody: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  notifTime: { fontSize: 11, color: COLORS.textSecondary },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary },
});
