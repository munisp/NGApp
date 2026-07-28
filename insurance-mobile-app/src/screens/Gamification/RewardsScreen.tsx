import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Text, Card, ProgressBar, Avatar, Badge } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  type: 'discount' | 'cashback' | 'gift' | 'upgrade';
  value: string;
  available: boolean;
  expiresAt?: string;
}

interface UserRewards {
  totalPoints: number;
  currentTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  nextTier: string;
  pointsToNextTier: number;
  achievements: Achievement[];
  availableRewards: Reward[];
  redeemedRewards: Reward[];
}

const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 1500,
  platinum: 5000,
};

const MOCK_DATA: UserRewards = {
  totalPoints: 1250,
  currentTier: 'silver',
  nextTier: 'gold',
  pointsToNextTier: 250,
  achievements: [
    { id: '1', name: 'First Policy', description: 'Purchase your first insurance policy', icon: 'shield-check', points: 100, unlocked: true, unlockedAt: '2024-01-15' },
    { id: '2', name: 'KYC Complete', description: 'Complete all KYC verification steps', icon: 'account-check', points: 150, unlocked: true, unlockedAt: '2024-01-16' },
    { id: '3', name: 'Referral Master', description: 'Refer 5 friends who purchase policies', icon: 'account-multiple-plus', points: 500, unlocked: false, progress: 3, maxProgress: 5 },
    { id: '4', name: 'Claim Free Year', description: 'Go a full year without filing a claim', icon: 'calendar-check', points: 300, unlocked: false, progress: 8, maxProgress: 12 },
    { id: '5', name: 'Premium Payer', description: 'Pay all premiums on time for 6 months', icon: 'cash-check', points: 200, unlocked: true, unlockedAt: '2024-06-01' },
    { id: '6', name: 'Review Writer', description: 'Write 3 reviews for your policies', icon: 'star', points: 75, unlocked: false, progress: 1, maxProgress: 3 },
  ],
  availableRewards: [
    { id: '1', name: '10% Premium Discount', description: 'Get 10% off your next premium payment', pointsCost: 500, type: 'discount', value: '10%', available: true },
    { id: '2', name: 'Free Health Checkup', description: 'Complimentary health checkup at partner hospitals', pointsCost: 750, type: 'gift', value: 'Health Checkup', available: true },
    { id: '3', name: '5000 NGN Cashback', description: 'Get 5000 NGN credited to your account', pointsCost: 1000, type: 'cashback', value: '5000 NGN', available: true },
    { id: '4', name: 'Policy Upgrade', description: 'Free upgrade to premium coverage for 3 months', pointsCost: 2000, type: 'upgrade', value: 'Premium Coverage', available: false },
  ],
  redeemedRewards: [],
};

export default function RewardsScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'achievements' | 'rewards'>('achievements');

  const { data: rewardsData = MOCK_DATA } = useQuery({
    queryKey: ['user-rewards'],
    queryFn: async () => {
      const response = await apiClient.get('/rewards');
      return response.data;
    },
    placeholderData: MOCK_DATA,
  });

  const tierProgress = (rewardsData.totalPoints - TIER_THRESHOLDS[rewardsData.currentTier]) /
    (TIER_THRESHOLDS[rewardsData.nextTier as keyof typeof TIER_THRESHOLDS] - TIER_THRESHOLDS[rewardsData.currentTier]);

  const renderAchievement = ({ item }: { item: Achievement }) => (
    <Card style={[styles.achievementCard, !item.unlocked && styles.achievementLocked]}>
      <Card.Content style={styles.achievementContent}>
        <View style={[styles.achievementIcon, { backgroundColor: item.unlocked ? theme.colors.success + '20' : theme.colors.border }]}>
          <Icon
            name={item.icon}
            size={32}
            color={item.unlocked ? theme.colors.success : theme.colors.textSecondary}
          />
        </View>
        <View style={styles.achievementInfo}>
          <Text style={styles.achievementName}>{item.name}</Text>
          <Text style={styles.achievementDescription}>{item.description}</Text>
          {item.unlocked ? (
            <View style={styles.unlockedBadge}>
              <Icon name="check-circle" size={14} color={theme.colors.success} />
              <Text style={styles.unlockedText}>Unlocked</Text>
            </View>
          ) : item.progress !== undefined && (
            <View style={styles.progressContainer}>
              <ProgressBar
                progress={item.progress / (item.maxProgress || 1)}
                color={theme.colors.primary}
                style={styles.progressBar}
              />
              <Text style={styles.progressText}>{item.progress}/{item.maxProgress}</Text>
            </View>
          )}
        </View>
        <View style={styles.pointsBadge}>
          <Icon name="star" size={16} color="#f59e0b" />
          <Text style={styles.pointsText}>{item.points}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  const renderReward = ({ item }: { item: Reward }) => {
    const canRedeem = rewardsData.totalPoints >= item.pointsCost && item.available;

    return (
      <Card style={styles.rewardCard}>
        <Card.Content>
          <View style={styles.rewardHeader}>
            <View style={[styles.rewardIcon, { backgroundColor: getRewardColor(item.type) + '20' }]}>
              <Icon name={getRewardIcon(item.type)} size={28} color={getRewardColor(item.type)} />
            </View>
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardName}>{item.name}</Text>
              <Text style={styles.rewardDescription}>{item.description}</Text>
            </View>
          </View>
          <View style={styles.rewardFooter}>
            <View style={styles.rewardCost}>
              <Icon name="star" size={20} color="#f59e0b" />
              <Text style={styles.rewardCostText}>{item.pointsCost} points</Text>
            </View>
            <TouchableOpacity
              style={[styles.redeemButton, !canRedeem && styles.redeemButtonDisabled]}
              disabled={!canRedeem}
            >
              <Text style={[styles.redeemText, !canRedeem && styles.redeemTextDisabled]}>
                {canRedeem ? 'Redeem' : item.available ? 'Not enough points' : 'Coming soon'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'discount': return 'percent';
      case 'cashback': return 'cash-refund';
      case 'gift': return 'gift';
      case 'upgrade': return 'arrow-up-circle';
      default: return 'star';
    }
  };

  const getRewardColor = (type: string) => {
    switch (type) {
      case 'discount': return theme.colors.primary;
      case 'cashback': return theme.colors.success;
      case 'gift': return '#8b5cf6';
      case 'upgrade': return '#f59e0b';
      default: return theme.colors.primary;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards & Achievements</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Card style={styles.tierCard}>
          <Card.Content>
            <View style={styles.tierHeader}>
              <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[rewardsData.currentTier] }]}>
                <Icon name="crown" size={32} color="#fff" />
              </View>
              <View style={styles.tierInfo}>
                <Text style={styles.tierName}>{rewardsData.currentTier.toUpperCase()} MEMBER</Text>
                <Text style={styles.totalPoints}>{rewardsData.totalPoints.toLocaleString()} points</Text>
              </View>
            </View>
            <View style={styles.tierProgress}>
              <Text style={styles.tierProgressLabel}>
                {rewardsData.pointsToNextTier} points to {rewardsData.nextTier}
              </Text>
              <ProgressBar
                progress={tierProgress}
                color={TIER_COLORS[rewardsData.nextTier as keyof typeof TIER_COLORS]}
                style={styles.tierProgressBar}
              />
            </View>
          </Card.Content>
        </Card>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'achievements' && styles.tabActive]}
            onPress={() => setActiveTab('achievements')}
          >
            <Icon
              name="trophy"
              size={20}
              color={activeTab === 'achievements' ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'achievements' && styles.tabTextActive]}>
              Achievements
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'rewards' && styles.tabActive]}
            onPress={() => setActiveTab('rewards')}
          >
            <Icon
              name="gift"
              size={20}
              color={activeTab === 'rewards' ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'rewards' && styles.tabTextActive]}>
              Rewards
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {activeTab === 'achievements' ? (
            <FlatList
              data={rewardsData.achievements}
              renderItem={renderAchievement}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <FlatList
              data={rewardsData.availableRewards}
              renderItem={renderReward}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  tierCard: {
    margin: spacing.md,
    backgroundColor: theme.colors.primary,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierInfo: {
    marginLeft: spacing.md,
  },
  tierName: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  totalPoints: {
    ...typography.h2,
    color: '#fff',
  },
  tierProgress: {
    marginTop: spacing.md,
  },
  tierProgressLabel: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing.xs,
  },
  tierProgressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: theme.roundness,
  },
  tabActive: {
    backgroundColor: theme.colors.primary + '15',
  },
  tabText: {
    ...typography.body,
    color: theme.colors.textSecondary,
    marginLeft: spacing.sm,
  },
  tabTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  listContainer: {
    padding: spacing.md,
  },
  achievementCard: {
    marginBottom: spacing.md,
  },
  achievementLocked: {
    opacity: 0.7,
  },
  achievementContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  achievementName: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  achievementDescription: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  unlockedText: {
    ...typography.small,
    color: theme.colors.success,
    marginLeft: spacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginLeft: spacing.sm,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: theme.roundness,
  },
  pointsText: {
    ...typography.caption,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: spacing.xs,
  },
  rewardCard: {
    marginBottom: spacing.md,
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rewardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rewardName: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  rewardDescription: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  rewardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardCost: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardCostText: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: spacing.xs,
  },
  redeemButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: theme.roundness,
  },
  redeemButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  redeemText: {
    ...typography.body,
    fontWeight: '600',
    color: '#fff',
  },
  redeemTextDisabled: {
    color: theme.colors.textSecondary,
  },
});
