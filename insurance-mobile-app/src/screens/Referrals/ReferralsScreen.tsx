import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { Card, Title, Text, Button, TextInput, Chip } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { referralsApi } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';
import { format } from 'date-fns';

interface Referral {
  id: number;
  name: string;
  email: string;
  status: 'Pending' | 'Registered' | 'Converted';
  reward: number;
  date: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  Pending: { bg: '#fef3c7', text: '#92400e' },
  Registered: { bg: '#dbeafe', text: '#1e40af' },
  Converted: { bg: '#dcfce7', text: '#166534' },
};

export default function ReferralsScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');

  const { data: statsData } = useQuery({
    queryKey: ['referralStats'],
    queryFn: () => referralsApi.getStats(),
  });

  const { data: referralsData, isLoading } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => referralsApi.getAll(),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: any) => referralsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      setEmail('');
      Alert.alert('Success', 'Invitation sent successfully!');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to send invitation');
    },
  });

  const stats = statsData?.data || {
    totalReferrals: 5,
    converted: 3,
    pending: 2,
    totalEarnings: 15000,
    referralCode: 'INSURE2024',
  };

  const referrals: Referral[] = referralsData?.data || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join InsurePortal and get ₦5,000 off your first policy! Use my referral code: ${stats.referralCode}\n\nDownload now: https://insureportal.ng/app`,
        title: 'Join InsurePortal',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleInvite = () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    inviteMutation.mutate({ email });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Title style={styles.headerTitle}>Referrals</Title>
        <View style={{ width: 24 }} />
      </View>

      <Card style={styles.heroCard}>
        <Card.Content style={styles.heroContent}>
          <Icon name="gift" size={48} color={theme.colors.primary} />
          <Title style={styles.heroTitle}>Earn ₦5,000 Per Referral</Title>
          <Text style={styles.heroSubtitle}>
            Invite friends to InsurePortal and earn rewards when they purchase their first policy
          </Text>
          
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Your Referral Code</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{stats.referralCode}</Text>
              <TouchableOpacity onPress={() => {}}>
                <Icon name="content-copy" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <Button
            mode="contained"
            onPress={handleShare}
            style={styles.shareButton}
            icon="share-variant"
          >
            Share Referral Link
          </Button>
        </Card.Content>
      </Card>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalReferrals}</Text>
          <Text style={styles.statLabel}>Total Referrals</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.converted}</Text>
          <Text style={styles.statLabel}>Converted</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>
            {formatCurrency(stats.totalEarnings)}
          </Text>
          <Text style={styles.statLabel}>Total Earned</Text>
        </View>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Invite by Email</Title>
          <View style={styles.inviteForm}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter friend's email"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.emailInput}
              mode="outlined"
            />
            <Button
              mode="contained"
              onPress={handleInvite}
              loading={inviteMutation.isPending}
              disabled={inviteMutation.isPending}
              style={styles.inviteButton}
            >
              Invite
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Your Referrals</Title>
          
          {referrals.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="account-multiple-plus" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No referrals yet</Text>
              <Text style={styles.emptySubtext}>Start inviting friends to earn rewards!</Text>
            </View>
          ) : (
            referrals.map((referral) => (
              <View key={referral.id} style={styles.referralItem}>
                <View style={styles.referralAvatar}>
                  <Text style={styles.referralInitial}>
                    {referral.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.referralInfo}>
                  <Text style={styles.referralName}>{referral.name}</Text>
                  <Text style={styles.referralEmail}>{referral.email}</Text>
                  <Text style={styles.referralDate}>
                    {format(new Date(referral.date), 'MMM dd, yyyy')}
                  </Text>
                </View>
                <View style={styles.referralStatus}>
                  <Chip
                    style={[styles.statusChip, { backgroundColor: statusColors[referral.status].bg }]}
                    textStyle={{ color: statusColors[referral.status].text, fontSize: 10 }}
                  >
                    {referral.status}
                  </Chip>
                  {referral.status === 'Converted' && (
                    <Text style={styles.rewardText}>+{formatCurrency(referral.reward)}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>How It Works</Title>
          
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Share Your Code</Text>
              <Text style={styles.stepDescription}>
                Share your unique referral code with friends and family
              </Text>
            </View>
          </View>
          
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Friend Signs Up</Text>
              <Text style={styles.stepDescription}>
                They create an account using your referral code
              </Text>
            </View>
          </View>
          
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Both Earn Rewards</Text>
              <Text style={styles.stepDescription}>
                You get ₦5,000 and they get ₦5,000 off their first policy
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
  },
  heroCard: {
    margin: spacing.md,
    backgroundColor: theme.colors.primary + '10',
  },
  heroContent: {
    alignItems: 'center',
    padding: spacing.md,
  },
  heroTitle: {
    ...typography.h2,
    color: theme.colors.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  codeContainer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  codeLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: theme.roundness,
    marginTop: spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
  },
  codeText: {
    ...typography.h3,
    color: theme.colors.primary,
    marginRight: spacing.md,
    letterSpacing: 2,
  },
  shareButton: {
    marginTop: spacing.lg,
    width: '100%',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: spacing.md,
    borderRadius: theme.roundness,
    alignItems: 'center',
    elevation: 2,
  },
  statValue: {
    ...typography.h2,
    color: theme.colors.text,
  },
  statLabel: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: {
    margin: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  inviteForm: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  emailInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  inviteButton: {
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: theme.colors.text,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  referralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  referralAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralInitial: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  referralInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  referralName: {
    ...typography.body,
    fontWeight: '500',
    color: theme.colors.text,
  },
  referralEmail: {
    ...typography.small,
    color: theme.colors.textSecondary,
  },
  referralDate: {
    ...typography.small,
    color: theme.colors.textSecondary,
  },
  referralStatus: {
    alignItems: 'flex-end',
  },
  statusChip: {
    height: 24,
  },
  rewardText: {
    ...typography.caption,
    fontWeight: '600',
    color: theme.colors.success,
    marginTop: spacing.xs,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    ...typography.body,
    fontWeight: '600',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  stepTitle: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  stepDescription: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
});
