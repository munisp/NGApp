import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function PolicyRenewalScreen() {
  const upcomingRenewals = [
    { id: '1', policy: 'Auto Insurance', expiry: 'Feb 15, 2024', daysLeft: 14, premium: 85000, autoRenew: true },
    { id: '2', policy: 'Health Insurance', expiry: 'Mar 01, 2024', daysLeft: 28, premium: 150000, autoRenew: false },
    { id: '3', policy: 'Home Insurance', expiry: 'Apr 10, 2024', daysLeft: 68, premium: 120000, autoRenew: true },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="bell-ring" size={32} color="#f97316" />
        <Text style={styles.title}>Policy Renewal</Text>
        <Text style={styles.subtitle}>Never miss a renewal date</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>3</Text>
          <Text style={styles.summaryLabel}>Upcoming</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>2</Text>
          <Text style={styles.summaryLabel}>Auto-Renew</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>₦355K</Text>
          <Text style={styles.summaryLabel}>Total Due</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Upcoming Renewals</Text>
      {upcomingRenewals.map((renewal) => (
        <View key={renewal.id} style={styles.renewalCard}>
          <View style={styles.renewalHeader}>
            <View style={[styles.urgencyBadge, renewal.daysLeft <= 14 ? styles.urgentBadge : styles.normalBadge]}>
              <Text style={[styles.urgencyText, renewal.daysLeft <= 14 ? styles.urgentText : styles.normalText]}>
                {renewal.daysLeft} days left
              </Text>
            </View>
            {renewal.autoRenew && (
              <View style={styles.autoRenewBadge}>
                <Icon name="autorenew" size={12} color="#22c55e" />
                <Text style={styles.autoRenewText}>Auto-renew</Text>
              </View>
            )}
          </View>
          <Text style={styles.policyName}>{renewal.policy}</Text>
          <Text style={styles.expiryDate}>Expires: {renewal.expiry}</Text>
          <View style={styles.renewalFooter}>
            <Text style={styles.premiumAmount}>₦{renewal.premium.toLocaleString()}</Text>
            <TouchableOpacity style={styles.renewButton}>
              <Text style={styles.renewButtonText}>Renew Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.reminderSettings}>
        <Text style={styles.reminderTitle}>Reminder Settings</Text>
        <View style={styles.reminderOption}>
          <Icon name="email" size={20} color="#6b7280" />
          <Text style={styles.reminderText}>Email reminders</Text>
          <Icon name="check-circle" size={20} color="#22c55e" />
        </View>
        <View style={styles.reminderOption}>
          <Icon name="message-text" size={20} color="#6b7280" />
          <Text style={styles.reminderText}>SMS reminders</Text>
          <Icon name="check-circle" size={20} color="#22c55e" />
        </View>
        <View style={styles.reminderOption}>
          <Icon name="whatsapp" size={20} color="#6b7280" />
          <Text style={styles.reminderText}>WhatsApp reminders</Text>
          <Icon name="check-circle" size={20} color="#22c55e" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  summaryCard: { flexDirection: 'row', backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#e5e7eb' },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: '#f97316' },
  summaryLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  renewalCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16 },
  renewalHeader: { flexDirection: 'row', marginBottom: 8 },
  urgencyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  urgentBadge: { backgroundColor: '#fef2f2' },
  normalBadge: { backgroundColor: '#fef3c7' },
  urgencyText: { fontSize: 12, fontWeight: '500' },
  urgentText: { color: '#dc2626' },
  normalText: { color: '#d97706' },
  autoRenewBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginLeft: 8 },
  autoRenewText: { fontSize: 12, color: '#166534', marginLeft: 4 },
  policyName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  expiryDate: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  renewalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  premiumAmount: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  renewButton: { backgroundColor: '#f97316', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  renewButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  reminderSettings: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  reminderTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  reminderOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  reminderText: { flex: 1, fontSize: 14, color: '#374151', marginLeft: 12 },
});
