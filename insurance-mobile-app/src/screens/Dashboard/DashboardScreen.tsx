import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { policiesApi, claimsApi, paymentsApi } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { spacing, typography, theme } from '../../utils/theme';

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  
  const { data: policies } = useQuery({
    queryKey: ['policies'],
    queryFn: () => policiesApi.getAll(),
  });

  const { data: claims } = useQuery({
    queryKey: ['claims'],
    queryFn: () => claimsApi.getAll(),
  });

  const { data: payments } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentsApi.getAll(),
  });

  const stats = [
    {
      title: 'Active Policies',
      value: policies?.data?.filter((p: any) => p.status === 'Active').length || 0,
      icon: 'shield-check',
      color: '#10b981',
      onPress: () => navigation.navigate('Policies'),
    },
    {
      title: 'Pending Claims',
      value: claims?.data?.filter((c: any) => c.status !== 'Paid').length || 0,
      icon: 'file-document',
      color: '#f59e0b',
      onPress: () => navigation.navigate('Claims'),
    },
    {
      title: 'Due Payments',
      value: payments?.data?.filter((p: any) => p.status === 'Pending').length || 0,
      icon: 'credit-card',
      color: '#ef4444',
      onPress: () => navigation.navigate('Payments'),
    },
  ];

  const quickActions = [
    {
      title: 'File a Claim',
      icon: 'file-plus',
      color: '#3b82f6',
      onPress: () => navigation.navigate('NewClaim'),
    },
    {
      title: 'Make Payment',
      icon: 'cash',
      color: '#10b981',
      onPress: () => navigation.navigate('Payments'),
    },
    {
      title: 'Refer a Friend',
      icon: 'account-multiple-plus',
      color: '#8b5cf6',
      onPress: () => navigation.navigate('Referrals'),
    },
    {
      title: 'Write Review',
      icon: 'star',
      color: '#f59e0b',
      onPress: () => navigation.navigate('Reviews'),
    },
  ];

  const businessServices = [
    {
      title: 'Reinsurance',
      icon: 'umbrella',
      color: '#0ea5e9',
      description: 'Treaty & exposure management',
      onPress: () => navigation.navigate('ReinsuranceManagement'),
    },
    {
      title: 'Risk Modeling',
      icon: 'chart-bell-curve',
      color: '#8b5cf6',
      description: 'MCMC risk analysis',
      onPress: () => navigation.navigate('MCMCRiskModeling'),
    },
    {
      title: 'Microinsurance',
      icon: 'account-group',
      color: '#10b981',
      description: 'Low-premium products',
      onPress: () => navigation.navigate('Microinsurance'),
    },
    {
      title: 'Model Security',
      icon: 'shield-lock',
      color: '#ef4444',
      description: 'ART adversarial testing',
      onPress: () => navigation.navigate('ModelSecurity'),
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>
        <Icon name="bell-outline" size={24} color={theme.colors.text} />
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <TouchableOpacity
            key={index}
            style={styles.statCard}
            onPress={stat.onPress}
          >
            <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
              <Icon name={stat.icon} size={24} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statTitle}>{stat.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Quick Actions</Title>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionButton}
                onPress={action.onPress}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                  <Icon name={action.icon} size={28} color={action.color} />
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Business Services */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Business Services</Title>
          <View style={styles.servicesGrid}>
            {businessServices.map((service, index) => (
              <TouchableOpacity
                key={index}
                style={styles.serviceButton}
                onPress={service.onPress}
              >
                <View style={[styles.serviceIcon, { backgroundColor: service.color + '20' }]}>
                  <Icon name={service.icon} size={24} color={service.color} />
                </View>
                <View style={styles.serviceContent}>
                  <Text style={styles.serviceTitle}>{service.title}</Text>
                  <Text style={styles.serviceDescription}>{service.description}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Recent Activity */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Recent Activity</Title>
          {claims?.data?.slice(0, 3).map((claim: any) => (
            <TouchableOpacity
              key={claim.id}
              style={styles.activityItem}
              onPress={() => navigation.navigate('ClaimDetail', { id: claim.id })}
            >
              <Icon name="file-document" size={20} color={theme.colors.primary} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Claim #{claim.claimNumber}</Text>
                <Text style={styles.activitySubtitle}>{claim.status}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ))}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  greeting: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  userName: {
    ...typography.h2,
    color: theme.colors.text,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h2,
    color: theme.colors.text,
    marginBottom: spacing.xs,
  },
  statTitle: {
    ...typography.small,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    margin: spacing.md,
    marginTop: 0,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    width: '47%',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionTitle: {
    ...typography.caption,
    color: theme.colors.text,
    textAlign: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  activityContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  activityTitle: {
    ...typography.body,
    color: theme.colors.text,
  },
  activitySubtitle: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  servicesGrid: {
    marginTop: spacing.md,
  },
  serviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness,
    marginBottom: spacing.sm,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  serviceTitle: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  serviceDescription: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
