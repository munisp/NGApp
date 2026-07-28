import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function ClaimsTrackerScreen() {
  const activeClaim = {
    id: 'CLM-2024-001',
    type: 'Auto Insurance',
    amount: 450000,
    status: 'Under Review',
    currentStep: 3,
    steps: [
      { id: 1, name: 'Claim Filed', date: 'Jan 15, 2024', completed: true },
      { id: 2, name: 'Documents Verified', date: 'Jan 16, 2024', completed: true },
      { id: 3, name: 'Under Review', date: 'Jan 18, 2024', completed: true, current: true },
      { id: 4, name: 'Approved', date: 'Pending', completed: false },
      { id: 5, name: 'Payment Processed', date: 'Pending', completed: false },
    ],
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="truck-delivery" size={32} color="#22c55e" />
        <Text style={styles.title}>Claims Tracker</Text>
        <Text style={styles.subtitle}>Track your claim like a delivery</Text>
      </View>

      <View style={styles.claimCard}>
        <View style={styles.claimHeader}>
          <View>
            <Text style={styles.claimId}>{activeClaim.id}</Text>
            <Text style={styles.claimType}>{activeClaim.type}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{activeClaim.status}</Text>
          </View>
        </View>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Claim Amount</Text>
          <Text style={styles.amountValue}>₦{activeClaim.amount.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>Claim Progress</Text>
        {activeClaim.steps.map((step, index) => (
          <View key={step.id} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View style={[
                styles.timelineDot,
                step.completed ? styles.completedDot : styles.pendingDot,
                step.current && styles.currentDot
              ]}>
                {step.completed && <Icon name="check" size={12} color="#fff" />}
              </View>
              {index < activeClaim.steps.length - 1 && (
                <View style={[styles.timelineLine, step.completed ? styles.completedLine : styles.pendingLine]} />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text style={[styles.stepName, step.current && styles.currentStepName]}>{step.name}</Text>
              <Text style={styles.stepDate}>{step.date}</Text>
            </View>
            {step.current && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.estimateCard}>
        <Icon name="clock-outline" size={24} color="#f59e0b" />
        <View style={styles.estimateInfo}>
          <Text style={styles.estimateLabel}>Estimated Completion</Text>
          <Text style={styles.estimateValue}>2-3 business days</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.contactButton}>
        <Icon name="headset" size={20} color="#fff" />
        <Text style={styles.contactButtonText}>Contact Claims Team</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  claimCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  claimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  claimId: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  claimType: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  statusBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { fontSize: 12, fontWeight: '600', color: '#d97706' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  amountLabel: { fontSize: 14, color: '#6b7280' },
  amountValue: { fontSize: 18, fontWeight: 'bold', color: '#22c55e' },
  timelineCard: { backgroundColor: '#fff', margin: 16, marginTop: 0, padding: 16, borderRadius: 12 },
  timelineTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 60 },
  timelineLeft: { alignItems: 'center', width: 24 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  completedDot: { backgroundColor: '#22c55e' },
  pendingDot: { backgroundColor: '#e5e7eb' },
  currentDot: { backgroundColor: '#3b82f6', borderWidth: 3, borderColor: '#93c5fd' },
  timelineLine: { width: 2, flex: 1, marginVertical: 4 },
  completedLine: { backgroundColor: '#22c55e' },
  pendingLine: { backgroundColor: '#e5e7eb' },
  timelineContent: { flex: 1, marginLeft: 12, paddingBottom: 16 },
  stepName: { fontSize: 14, fontWeight: '500', color: '#374151' },
  currentStepName: { color: '#3b82f6', fontWeight: '600' },
  stepDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  currentBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  currentBadgeText: { fontSize: 10, color: '#2563eb', fontWeight: '600' },
  estimateCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', margin: 16, marginTop: 0, padding: 16, borderRadius: 12 },
  estimateInfo: { marginLeft: 12 },
  estimateLabel: { fontSize: 12, color: '#92400e' },
  estimateValue: { fontSize: 16, fontWeight: '600', color: '#d97706' },
  contactButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#22c55e', margin: 16, padding: 16, borderRadius: 12 },
  contactButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
});
