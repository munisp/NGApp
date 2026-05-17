import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function HealthWellnessScreen() {
  const healthStats = {
    steps: 8432,
    stepsGoal: 10000,
    calories: 1850,
    sleep: 7.2,
    heartRate: 72,
  };

  const rewards = [
    { id: '1', name: '10K Steps Challenge', points: 500, progress: 84, icon: 'walk' },
    { id: '2', name: 'Weekly Workout', points: 300, progress: 60, icon: 'dumbbell' },
    { id: '3', name: 'Sleep 8 Hours', points: 200, progress: 90, icon: 'sleep' },
  ];

  const partners = [
    { id: '1', name: 'Telemedicine', description: 'Free video consultations', icon: 'video' },
    { id: '2', name: 'Mental Health', description: 'Therapy sessions', icon: 'head-heart' },
    { id: '3', name: 'Gym Discounts', description: '30% off memberships', icon: 'weight-lifter' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="heart-pulse" size={32} color="#ef4444" />
        <Text style={styles.title}>Health & Wellness</Text>
        <Text style={styles.subtitle}>Stay healthy, save on premiums</Text>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.mainStat}>
          <Icon name="shoe-print" size={32} color="#ef4444" />
          <Text style={styles.mainStatValue}>{healthStats.steps.toLocaleString()}</Text>
          <Text style={styles.mainStatLabel}>steps today</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(healthStats.steps / healthStats.stepsGoal) * 100}%` }]} />
          </View>
          <Text style={styles.goalText}>{healthStats.stepsGoal.toLocaleString()} goal</Text>
        </View>
        <View style={styles.secondaryStats}>
          <View style={styles.secondaryStat}>
            <Icon name="fire" size={20} color="#f97316" />
            <Text style={styles.secondaryValue}>{healthStats.calories}</Text>
            <Text style={styles.secondaryLabel}>cal</Text>
          </View>
          <View style={styles.secondaryStat}>
            <Icon name="sleep" size={20} color="#8b5cf6" />
            <Text style={styles.secondaryValue}>{healthStats.sleep}h</Text>
            <Text style={styles.secondaryLabel}>sleep</Text>
          </View>
          <View style={styles.secondaryStat}>
            <Icon name="heart" size={20} color="#ef4444" />
            <Text style={styles.secondaryValue}>{healthStats.heartRate}</Text>
            <Text style={styles.secondaryLabel}>bpm</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Wellness Rewards</Text>
      {rewards.map((reward) => (
        <View key={reward.id} style={styles.rewardCard}>
          <View style={styles.rewardIcon}>
            <Icon name={reward.icon} size={24} color="#ef4444" />
          </View>
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardName}>{reward.name}</Text>
            <View style={styles.rewardProgress}>
              <View style={styles.rewardProgressBar}>
                <View style={[styles.rewardProgressFill, { width: `${reward.progress}%` }]} />
              </View>
              <Text style={styles.rewardProgressText}>{reward.progress}%</Text>
            </View>
          </View>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsText}>{reward.points} pts</Text>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Partner Services</Text>
      {partners.map((partner) => (
        <TouchableOpacity key={partner.id} style={styles.partnerCard}>
          <View style={styles.partnerIcon}>
            <Icon name={partner.icon} size={24} color="#22c55e" />
          </View>
          <View style={styles.partnerInfo}>
            <Text style={styles.partnerName}>{partner.name}</Text>
            <Text style={styles.partnerDescription}>{partner.description}</Text>
          </View>
          <Icon name="chevron-right" size={24} color="#9ca3af" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  statsCard: { backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 16 },
  mainStat: { alignItems: 'center', marginBottom: 20 },
  mainStatValue: { fontSize: 40, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  mainStatLabel: { fontSize: 14, color: '#6b7280' },
  progressBar: { width: '100%', height: 8, backgroundColor: '#fee2e2', borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#ef4444', borderRadius: 4 },
  goalText: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  secondaryStats: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  secondaryStat: { alignItems: 'center' },
  secondaryValue: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginTop: 4 },
  secondaryLabel: { fontSize: 12, color: '#6b7280' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  rewardCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  rewardIcon: { width: 48, height: 48, backgroundColor: '#fef2f2', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rewardInfo: { flex: 1, marginLeft: 12 },
  rewardName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  rewardProgress: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rewardProgressBar: { flex: 1, height: 6, backgroundColor: '#fee2e2', borderRadius: 3, overflow: 'hidden' },
  rewardProgressFill: { height: '100%', backgroundColor: '#ef4444', borderRadius: 3 },
  rewardProgressText: { fontSize: 12, color: '#6b7280', marginLeft: 8, width: 35 },
  pointsBadge: { backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  pointsText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  partnerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  partnerIcon: { width: 48, height: 48, backgroundColor: '#dcfce7', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  partnerInfo: { flex: 1, marginLeft: 12 },
  partnerName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  partnerDescription: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
