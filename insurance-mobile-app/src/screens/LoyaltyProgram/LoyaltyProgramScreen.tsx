import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Activity {
  id: string;
  type: 'earned' | 'redeemed';
  description: string;
  points: number;
  date: string;
}

interface Reward {
  id: string;
  name: string;
  points: number;
  icon: string;
  available: boolean;
}

const userTier = {
  current: 'Gold',
  points: 12450,
  pointsToNext: 2550,
  nextTier: 'Platinum',
  memberSince: 'January 2022',
  totalSaved: 185000,
};

const tiers = [
  { name: 'Bronze', minPoints: 0, discount: 5, color: '#cd7f32' },
  { name: 'Silver', minPoints: 5000, discount: 10, color: '#c0c0c0' },
  { name: 'Gold', minPoints: 10000, discount: 15, color: '#ffd700' },
  { name: 'Platinum', minPoints: 15000, discount: 20, color: '#e5e4e2' },
];

const recentActivity: Activity[] = [
  { id: '1', type: 'earned', description: 'Premium payment', points: 100, date: 'Jan 28, 2026' },
  { id: '2', type: 'earned', description: 'Referral bonus (Adebayo O.)', points: 500, date: 'Jan 25, 2026' },
  { id: '3', type: 'redeemed', description: 'Redeemed: ₦5,000 Credit', points: -2500, date: 'Jan 20, 2026' },
  { id: '4', type: 'earned', description: 'Policy anniversary bonus', points: 500, date: 'Jan 15, 2026' },
  { id: '5', type: 'earned', description: 'Review submitted', points: 100, date: 'Jan 10, 2026' },
];

const rewards: Reward[] = [
  { id: '1', name: '₦2,500 Premium Credit', points: 1000, icon: 'cash', available: true },
  { id: '2', name: '₦5,000 Premium Credit', points: 2500, icon: 'cash-multiple', available: true },
  { id: '3', name: 'Free Roadside Assistance', points: 3000, icon: 'car-wrench', available: true },
  { id: '4', name: '₦10,000 Premium Credit', points: 5000, icon: 'wallet-giftcard', available: true },
  { id: '5', name: 'Premium Health Checkup', points: 7500, icon: 'hospital-box', available: false },
];

const earnMethods = [
  { icon: 'credit-card', label: 'Pay premium on time', points: 100 },
  { icon: 'account-plus', label: 'Refer a friend', points: 500 },
  { icon: 'account-check', label: 'Complete profile', points: 200 },
  { icon: 'account-group', label: 'Add family member', points: 300 },
  { icon: 'star', label: 'Write a review', points: 100 },
  { icon: 'file-document', label: 'Submit documents', points: 50 },
];

export default function LoyaltyProgramScreen() {
  const [activeTab, setActiveTab] = useState<'overview' | 'earn' | 'rewards' | 'tiers'>('overview');

  const currentTierIndex = tiers.findIndex((t) => t.name === userTier.current);
  const progressPercentage = ((userTier.points - tiers[currentTierIndex].minPoints) /
    (tiers[currentTierIndex + 1]?.minPoints - tiers[currentTierIndex].minPoints || 1)) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Loyalty Program</Text>
        <TouchableOpacity style={styles.redeemButton}>
          <Icon name="gift" size={16} color="#ffffff" />
          <Text style={styles.redeemButtonText}>Redeem</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.tierCard}>
          <View style={styles.tierHeader}>
            <View style={styles.tierBadge}>
              <Icon name="crown" size={32} color="#ffd700" />
            </View>
            <View style={styles.tierInfo}>
              <Text style={styles.tierName}>{userTier.current} Member</Text>
              <Text style={styles.memberSince}>Member since {userTier.memberSince}</Text>
            </View>
            <View style={styles.pointsContainer}>
              <Text style={styles.pointsValue}>{userTier.points.toLocaleString()}</Text>
              <Text style={styles.pointsLabel}>Points</Text>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>{userTier.current}</Text>
              <Text style={styles.progressLabel}>{userTier.pointsToNext} pts to {userTier.nextTier}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
            </View>
          </View>
          <View style={styles.tierBenefits}>
            <View style={styles.benefitItem}>
              <Icon name="percent" size={16} color="#22c55e" />
              <Text style={styles.benefitText}>15% Premium Discount</Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="currency-ngn" size={16} color="#22c55e" />
              <Text style={styles.benefitText}>₦{userTier.totalSaved.toLocaleString()} Saved</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabContainer}>
          {['overview', 'earn', 'rewards', 'tiers'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'overview' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityList}>
              {recentActivity.map((activity) => (
                <View key={activity.id} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Icon
                      name={activity.type === 'earned' ? 'arrow-up-circle' : 'arrow-down-circle'}
                      size={24}
                      color={activity.type === 'earned' ? '#22c55e' : '#ef4444'}
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityDesc}>{activity.description}</Text>
                    <Text style={styles.activityDate}>{activity.date}</Text>
                  </View>
                  <Text
                    style={[
                      styles.activityPoints,
                      { color: activity.type === 'earned' ? '#22c55e' : '#ef4444' },
                    ]}
                  >
                    {activity.type === 'earned' ? '+' : ''}{activity.points} pts
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'earn' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ways to Earn Points</Text>
            <View style={styles.earnGrid}>
              {earnMethods.map((method, index) => (
                <TouchableOpacity key={index} style={styles.earnCard}>
                  <Icon name={method.icon} size={28} color="#3b82f6" />
                  <Text style={styles.earnLabel}>{method.label}</Text>
                  <Text style={styles.earnPoints}>+{method.points} pts</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'rewards' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Rewards</Text>
            {rewards.map((reward) => (
              <View key={reward.id} style={styles.rewardCard}>
                <View style={styles.rewardIcon}>
                  <Icon name={reward.icon} size={28} color="#3b82f6" />
                </View>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardName}>{reward.name}</Text>
                  <Text style={styles.rewardPoints}>{reward.points.toLocaleString()} points</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.rewardButton,
                    !reward.available && styles.rewardButtonDisabled,
                    userTier.points < reward.points && styles.rewardButtonDisabled,
                  ]}
                  disabled={!reward.available || userTier.points < reward.points}
                >
                  <Text
                    style={[
                      styles.rewardButtonText,
                      (!reward.available || userTier.points < reward.points) &&
                        styles.rewardButtonTextDisabled,
                    ]}
                  >
                    {userTier.points >= reward.points ? 'Redeem' : 'Locked'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'tiers' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Membership Tiers</Text>
            {tiers.map((tier, index) => (
              <View
                key={tier.name}
                style={[
                  styles.tierInfoCard,
                  tier.name === userTier.current && styles.tierInfoCardActive,
                ]}
              >
                <View style={[styles.tierIcon, { backgroundColor: tier.color + '30' }]}>
                  <Icon name="crown" size={24} color={tier.color} />
                </View>
                <View style={styles.tierDetails}>
                  <Text style={styles.tierInfoName}>{tier.name}</Text>
                  <Text style={styles.tierInfoPoints}>
                    {tier.minPoints.toLocaleString()}+ points
                  </Text>
                </View>
                <View style={styles.tierDiscount}>
                  <Text style={styles.tierDiscountValue}>{tier.discount}%</Text>
                  <Text style={styles.tierDiscountLabel}>Discount</Text>
                </View>
                {tier.name === userTier.current && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  redeemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  redeemButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
  },
  content: {
    flex: 1,
  },
  tierCard: {
    margin: 16,
    backgroundColor: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#f59e0b',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tierName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  memberSince: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  pointsContainer: {
    alignItems: 'flex-end',
  },
  pointsValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  pointsLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  progressContainer: {
    marginTop: 20,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 4,
  },
  tierBenefits: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  benefitText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 13,
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  activityList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activityIcon: {
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  activityDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  activityPoints: {
    fontSize: 14,
    fontWeight: '600',
  },
  earnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  earnCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  earnLabel: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    marginTop: 8,
  },
  earnPoints: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    marginTop: 4,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rewardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  rewardPoints: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  rewardButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  rewardButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  rewardButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  rewardButtonTextDisabled: {
    color: '#9ca3af',
  },
  tierInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tierInfoCardActive: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  tierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierDetails: {
    flex: 1,
    marginLeft: 12,
  },
  tierInfoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  tierInfoPoints: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  tierDiscount: {
    alignItems: 'center',
  },
  tierDiscountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
  },
  tierDiscountLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  currentBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
});
