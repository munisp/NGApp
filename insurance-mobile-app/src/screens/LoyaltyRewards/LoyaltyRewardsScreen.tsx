import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function LoyaltyRewardsScreen() {
  const userTier = { name: 'Gold', points: 15420, nextTier: 'Platinum', pointsToNext: 4580 };

  const rewards = [
    { id: '1', name: '₦5,000 Premium Discount', points: 5000, category: 'Insurance', icon: 'percent' },
    { id: '2', name: 'Free Health Checkup', points: 3000, category: 'Health', icon: 'heart-pulse' },
    { id: '3', name: 'Airport Lounge Access', points: 8000, category: 'Travel', icon: 'airplane' },
    { id: '4', name: '₦2,000 Fuel Voucher', points: 2000, category: 'Auto', icon: 'gas-station' },
  ];

  const referralCode = 'JOHN2024';
  const referralEarnings = 45000;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="crown" size={32} color="#f59e0b" />
        <Text style={styles.title}>Loyalty & Rewards</Text>
        <Text style={styles.subtitle}>Earn points, get rewards</Text>
      </View>

      <View style={styles.tierCard}>
        <View style={styles.tierBadge}>
          <Icon name="medal" size={24} color="#f59e0b" />
          <Text style={styles.tierName}>{userTier.name} Member</Text>
        </View>
        <Text style={styles.pointsValue}>{userTier.points.toLocaleString()}</Text>
        <Text style={styles.pointsLabel}>Available Points</Text>
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(userTier.points / (userTier.points + userTier.pointsToNext)) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{userTier.pointsToNext.toLocaleString()} points to {userTier.nextTier}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Redeem Rewards</Text>
      {rewards.map((reward) => (
        <View key={reward.id} style={styles.rewardCard}>
          <View style={styles.rewardIcon}>
            <Icon name={reward.icon} size={24} color="#f59e0b" />
          </View>
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardName}>{reward.name}</Text>
            <Text style={styles.rewardCategory}>{reward.category}</Text>
          </View>
          <TouchableOpacity style={[styles.redeemButton, userTier.points < reward.points && styles.disabledButton]}>
            <Text style={[styles.redeemText, userTier.points < reward.points && styles.disabledText]}>
              {reward.points.toLocaleString()} pts
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.referralCard}>
        <Text style={styles.referralTitle}>Refer & Earn</Text>
        <Text style={styles.referralDescription}>Share your code and earn ₦5,000 for each friend who signs up</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{referralCode}</Text>
          <TouchableOpacity style={styles.copyButton}>
            <Icon name="content-copy" size={20} color="#f59e0b" />
          </TouchableOpacity>
        </View>
        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Total Earnings</Text>
          <Text style={styles.earningsValue}>₦{referralEarnings.toLocaleString()}</Text>
        </View>
        <TouchableOpacity style={styles.shareButton}>
          <Icon name="share-variant" size={20} color="#fff" />
          <Text style={styles.shareButtonText}>Share Code</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  tierCard: { backgroundColor: '#fffbeb', margin: 16, padding: 20, borderRadius: 16, borderWidth: 2, borderColor: '#f59e0b' },
  tierBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tierName: { fontSize: 16, fontWeight: '600', color: '#d97706', marginLeft: 8 },
  pointsValue: { fontSize: 40, fontWeight: 'bold', color: '#111827' },
  pointsLabel: { fontSize: 14, color: '#6b7280' },
  progressSection: { marginTop: 16 },
  progressBar: { height: 8, backgroundColor: '#fef3c7', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 4 },
  progressText: { fontSize: 12, color: '#d97706', marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  rewardCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  rewardIcon: { width: 48, height: 48, backgroundColor: '#fffbeb', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rewardInfo: { flex: 1, marginLeft: 12 },
  rewardName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  rewardCategory: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  redeemButton: { backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  disabledButton: { backgroundColor: '#e5e7eb' },
  redeemText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  disabledText: { color: '#9ca3af' },
  referralCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  referralTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  referralDescription: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  codeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', padding: 12, borderRadius: 8, marginTop: 12 },
  codeText: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#d97706', letterSpacing: 2 },
  copyButton: { padding: 8 },
  earningsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  earningsLabel: { fontSize: 14, color: '#6b7280' },
  earningsValue: { fontSize: 18, fontWeight: 'bold', color: '#22c55e' },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f59e0b', padding: 14, borderRadius: 8, marginTop: 16 },
  shareButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
});
