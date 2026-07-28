import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function FinancialWellnessScreen() {
  const [showBalance, setShowBalance] = useState(true);
  const creditScore = 720;
  const netWorth = 6400000;
  const savingsRate = 27;

  const goals = [
    { id: '1', name: 'Emergency Fund', target: 2500000, current: 1800000, icon: 'shield' },
    { id: '2', name: 'Home Down Payment', target: 10000000, current: 3200000, icon: 'home' },
    { id: '3', name: 'Retirement', target: 50000000, current: 8900000, icon: 'beach' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="wallet" size={32} color="#10b981" />
        <Text style={styles.title}>Financial Wellness</Text>
        <Text style={styles.subtitle}>Track your financial health</Text>
      </View>

      <View style={styles.scoreCard}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Credit Score</Text>
            <Text style={[styles.scoreValue, { color: '#22c55e' }]}>{creditScore}</Text>
            <Text style={styles.scoreStatus}>Good</Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Net Worth</Text>
            <Text style={styles.scoreValue}>{showBalance ? `₦${(netWorth / 1000000).toFixed(1)}M` : '••••'}</Text>
            <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
              <Icon name={showBalance ? 'eye' : 'eye-off'} size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Savings Rate</Text>
            <Text style={[styles.scoreValue, { color: '#10b981' }]}>{savingsRate}%</Text>
            <Text style={styles.scoreStatus}>Excellent</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Financial Goals</Text>
      {goals.map((goal) => {
        const progress = (goal.current / goal.target) * 100;
        return (
          <View key={goal.id} style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={styles.goalIcon}>
                <Icon name={goal.icon} size={20} color="#10b981" />
              </View>
              <View style={styles.goalInfo}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={styles.goalProgress}>
                  {showBalance ? `₦${(goal.current / 1000000).toFixed(1)}M` : '••••'} / ₦{(goal.target / 1000000).toFixed(0)}M
                </Text>
              </View>
              <Text style={styles.goalPercent}>{progress.toFixed(0)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        );
      })}

      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>AI Recommendations</Text>
        <View style={styles.tipItem}>
          <Icon name="lightbulb" size={20} color="#f59e0b" />
          <Text style={styles.tipText}>Increase emergency fund by ₦50,000/month</Text>
        </View>
        <View style={styles.tipItem}>
          <Icon name="lightbulb" size={20} color="#f59e0b" />
          <Text style={styles.tipText}>Bundle insurance to save 15% on premiums</Text>
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
  scoreCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scoreItem: { flex: 1, alignItems: 'center' },
  scoreDivider: { width: 1, backgroundColor: '#e5e7eb' },
  scoreLabel: { fontSize: 12, color: '#6b7280' },
  scoreValue: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginVertical: 4 },
  scoreStatus: { fontSize: 12, color: '#22c55e' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  goalCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 16 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  goalIcon: { width: 40, height: 40, backgroundColor: '#d1fae5', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  goalInfo: { flex: 1, marginLeft: 12 },
  goalName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  goalProgress: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  goalPercent: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  progressBar: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  tipsCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  tipsTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  tipItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tipText: { fontSize: 14, color: '#6b7280', marginLeft: 8, flex: 1 },
});
