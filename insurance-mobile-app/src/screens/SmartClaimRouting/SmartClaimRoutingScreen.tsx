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

interface Claim {
  id: string;
  claimNumber: string;
  type: string;
  complexity: 'Low' | 'Medium' | 'High' | 'Very High';
  priority: 'Normal' | 'Urgent';
  customer: string;
  amount: number;
  submittedAt: string;
  recommendedAdjuster: {
    name: string;
    matchScore: number;
    reason: string;
  };
}

interface Adjuster {
  id: string;
  name: string;
  specialty: string[];
  currentLoad: number;
  maxLoad: number;
  avgResolutionTime: string;
  satisfaction: number;
  status: 'available' | 'busy' | 'away';
}

const metrics = {
  totalClaims: 847,
  autoRouted: 723,
  manualOverride: 124,
  avgProcessingTime: '2.3 days',
  slaCompliance: 94.2,
  customerSatisfaction: 4.6,
};

const pendingClaims: Claim[] = [
  {
    id: '1',
    claimNumber: 'CLM-2026-8901',
    type: 'Auto',
    complexity: 'High',
    priority: 'Urgent',
    customer: 'Adebayo Enterprises',
    amount: 450000,
    submittedAt: '2 hours ago',
    recommendedAdjuster: {
      name: 'Amina Yusuf',
      matchScore: 96,
      reason: 'Expertise match + Low workload',
    },
  },
  {
    id: '2',
    claimNumber: 'CLM-2026-8902',
    type: 'Health',
    complexity: 'Medium',
    priority: 'Normal',
    customer: 'Ngozi Okonkwo',
    amount: 125000,
    submittedAt: '4 hours ago',
    recommendedAdjuster: {
      name: 'Fatima Ibrahim',
      matchScore: 92,
      reason: 'Health specialty + Good resolution',
    },
  },
  {
    id: '3',
    claimNumber: 'CLM-2026-8903',
    type: 'Agriculture',
    complexity: 'High',
    priority: 'Urgent',
    customer: 'Lagos Fresh Farms',
    amount: 890000,
    submittedAt: '6 hours ago',
    recommendedAdjuster: {
      name: 'Chukwuemeka Obi',
      matchScore: 88,
      reason: 'Agriculture specialist',
    },
  },
];

const adjusters: Adjuster[] = [
  {
    id: '1',
    name: 'Amina Yusuf',
    specialty: ['Auto', 'Property'],
    currentLoad: 8,
    maxLoad: 15,
    avgResolutionTime: '1.8 days',
    satisfaction: 4.8,
    status: 'available',
  },
  {
    id: '2',
    name: 'Fatima Ibrahim',
    specialty: ['Health', 'Life'],
    currentLoad: 12,
    maxLoad: 15,
    avgResolutionTime: '2.1 days',
    satisfaction: 4.7,
    status: 'busy',
  },
  {
    id: '3',
    name: 'Chukwuemeka Obi',
    specialty: ['Agriculture', 'Property'],
    currentLoad: 14,
    maxLoad: 15,
    avgResolutionTime: '2.5 days',
    satisfaction: 4.5,
    status: 'busy',
  },
  {
    id: '4',
    name: 'Oluwaseun Adeyemi',
    specialty: ['Property', 'Commercial'],
    currentLoad: 6,
    maxLoad: 15,
    avgResolutionTime: '1.5 days',
    satisfaction: 4.9,
    status: 'available',
  },
];

export default function SmartClaimRoutingScreen() {
  const [activeTab, setActiveTab] = useState<'queue' | 'adjusters' | 'analytics'>('queue');

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Low':
        return '#22c55e';
      case 'Medium':
        return '#eab308';
      case 'High':
        return '#f97316';
      case 'Very High':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#22c55e';
      case 'busy':
        return '#f97316';
      case 'away':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString()}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Smart Claim Routing</Text>
        <TouchableOpacity style={styles.optimizeButton}>
          <Icon name="refresh" size={16} color="#ffffff" />
          <Text style={styles.optimizeButtonText}>Optimize</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.totalClaims}</Text>
            <Text style={styles.metricLabel}>Total Claims</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardSuccess]}>
            <Text style={[styles.metricValue, { color: '#22c55e' }]}>{metrics.autoRouted}</Text>
            <Text style={styles.metricLabel}>Auto-Routed</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.avgProcessingTime}</Text>
            <Text style={styles.metricLabel}>Avg Processing</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardHighlight]}>
            <Text style={[styles.metricValue, { color: '#3b82f6' }]}>{metrics.slaCompliance}%</Text>
            <Text style={styles.metricLabel}>SLA Compliance</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          {['queue', 'adjusters', 'analytics'].map((tab) => (
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

        {activeTab === 'queue' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AI-Suggested Assignments</Text>
              <TouchableOpacity style={styles.approveAllButton}>
                <Text style={styles.approveAllText}>Approve All</Text>
              </TouchableOpacity>
            </View>
            {pendingClaims.map((claim) => (
              <View key={claim.id} style={styles.claimCard}>
                <View style={styles.claimHeader}>
                  <View>
                    <View style={styles.claimTitleRow}>
                      <Text style={styles.claimNumber}>{claim.claimNumber}</Text>
                      <View style={[styles.typeBadge, { backgroundColor: getComplexityColor(claim.complexity) + '20' }]}>
                        <Text style={[styles.typeBadgeText, { color: getComplexityColor(claim.complexity) }]}>
                          {claim.type}
                        </Text>
                      </View>
                      {claim.priority === 'Urgent' && (
                        <View style={styles.urgentBadge}>
                          <Text style={styles.urgentBadgeText}>Urgent</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.claimCustomer}>{claim.customer}</Text>
                  </View>
                  <View style={styles.claimAmount}>
                    <Text style={styles.claimAmountValue}>{formatCurrency(claim.amount)}</Text>
                    <Text style={styles.claimAmountTime}>{claim.submittedAt}</Text>
                  </View>
                </View>

                <View style={styles.recommendationBox}>
                  <View style={styles.recommendationHeader}>
                    <Icon name="robot" size={16} color="#3b82f6" />
                    <Text style={styles.recommendationLabel}>AI Recommendation:</Text>
                  </View>
                  <View style={styles.recommendationContent}>
                    <Text style={styles.adjusterName}>{claim.recommendedAdjuster.name}</Text>
                    <View style={styles.matchScoreBadge}>
                      <Text style={styles.matchScoreText}>{claim.recommendedAdjuster.matchScore}% match</Text>
                    </View>
                  </View>
                  <Text style={styles.recommendationReason}>{claim.recommendedAdjuster.reason}</Text>
                </View>

                <View style={styles.claimActions}>
                  <TouchableOpacity style={styles.approveButton}>
                    <Icon name="check" size={16} color="#ffffff" />
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reassignButton}>
                    <Icon name="account-switch" size={16} color="#3b82f6" />
                    <Text style={styles.reassignButtonText}>Reassign</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.escalateButton}>
                    <Icon name="alert" size={16} color="#f97316" />
                    <Text style={styles.escalateButtonText}>Escalate</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'adjusters' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Claims Adjusters</Text>
            {adjusters.map((adjuster) => (
              <View key={adjuster.id} style={styles.adjusterCard}>
                <View style={styles.adjusterHeader}>
                  <View style={styles.adjusterAvatar}>
                    <Text style={styles.adjusterInitial}>{adjuster.name.charAt(0)}</Text>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(adjuster.status) }]} />
                  </View>
                  <View style={styles.adjusterInfo}>
                    <Text style={styles.adjusterName}>{adjuster.name}</Text>
                    <View style={styles.specialtyTags}>
                      {adjuster.specialty.map((spec, index) => (
                        <View key={index} style={styles.specialtyTag}>
                          <Text style={styles.specialtyTagText}>{spec}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.adjusterStats}>
                  <View style={styles.adjusterStat}>
                    <Text style={styles.adjusterStatLabel}>Workload</Text>
                    <View style={styles.workloadBar}>
                      <View
                        style={[
                          styles.workloadFill,
                          {
                            width: `${(adjuster.currentLoad / adjuster.maxLoad) * 100}%`,
                            backgroundColor: adjuster.currentLoad > 12 ? '#f97316' : '#22c55e',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.workloadText}>
                      {adjuster.currentLoad}/{adjuster.maxLoad}
                    </Text>
                  </View>
                  <View style={styles.adjusterStat}>
                    <Text style={styles.adjusterStatLabel}>Avg Time</Text>
                    <Text style={styles.adjusterStatValue}>{adjuster.avgResolutionTime}</Text>
                  </View>
                  <View style={styles.adjusterStat}>
                    <Text style={styles.adjusterStatLabel}>Rating</Text>
                    <View style={styles.ratingContainer}>
                      <Icon name="star" size={14} color="#f59e0b" />
                      <Text style={styles.ratingText}>{adjuster.satisfaction}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.assignButton}>
                  <Text style={styles.assignButtonText}>Assign Claim</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'analytics' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Routing Analytics</Text>
            
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>Routing Efficiency</Text>
              <View style={styles.efficiencyStats}>
                <View style={styles.efficiencyStat}>
                  <Text style={styles.efficiencyValue}>85%</Text>
                  <Text style={styles.efficiencyLabel}>Auto-Route Rate</Text>
                </View>
                <View style={styles.efficiencyStat}>
                  <Text style={styles.efficiencyValue}>49%</Text>
                  <Text style={styles.efficiencyLabel}>Time Improvement</Text>
                </View>
                <View style={styles.efficiencyStat}>
                  <Text style={styles.efficiencyValue}>92%</Text>
                  <Text style={styles.efficiencyLabel}>First-Time Match</Text>
                </View>
              </View>
            </View>

            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>Processing Time Trend</Text>
              <View style={styles.trendContainer}>
                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>Before AI</Text>
                  <View style={styles.trendBar}>
                    <View style={[styles.trendFill, { width: '100%', backgroundColor: '#ef4444' }]} />
                  </View>
                  <Text style={styles.trendValue}>4.5 days</Text>
                </View>
                <View style={styles.trendItem}>
                  <Text style={styles.trendLabel}>After AI</Text>
                  <View style={styles.trendBar}>
                    <View style={[styles.trendFill, { width: '51%', backgroundColor: '#22c55e' }]} />
                  </View>
                  <Text style={styles.trendValue}>2.3 days</Text>
                </View>
              </View>
            </View>

            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>Claims by Category</Text>
              <View style={styles.categoryList}>
                <View style={styles.categoryItem}>
                  <View style={[styles.categoryDot, { backgroundColor: '#3b82f6' }]} />
                  <Text style={styles.categoryLabel}>Auto</Text>
                  <Text style={styles.categoryValue}>37%</Text>
                </View>
                <View style={styles.categoryItem}>
                  <View style={[styles.categoryDot, { backgroundColor: '#22c55e' }]} />
                  <Text style={styles.categoryLabel}>Health</Text>
                  <Text style={styles.categoryValue}>29%</Text>
                </View>
                <View style={styles.categoryItem}>
                  <View style={[styles.categoryDot, { backgroundColor: '#f59e0b' }]} />
                  <Text style={styles.categoryLabel}>Property</Text>
                  <Text style={styles.categoryValue}>18%</Text>
                </View>
                <View style={styles.categoryItem}>
                  <View style={[styles.categoryDot, { backgroundColor: '#8b5cf6' }]} />
                  <Text style={styles.categoryLabel}>Agriculture</Text>
                  <Text style={styles.categoryValue}>16%</Text>
                </View>
              </View>
            </View>
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
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  optimizeButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
  },
  content: {
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  metricCardSuccess: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  metricCardHighlight: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  approveAllButton: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  approveAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22c55e',
  },
  claimCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  claimTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  claimNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  urgentBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },
  claimCustomer: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  claimAmount: {
    alignItems: 'flex-end',
  },
  claimAmountValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  claimAmountTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  recommendationBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationLabel: {
    fontSize: 12,
    color: '#3b82f6',
    marginLeft: 6,
    fontWeight: '500',
  },
  recommendationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adjusterName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  matchScoreBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  matchScoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
  },
  recommendationReason: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  claimActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  approveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 13,
  },
  reassignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reassignButtonText: {
    color: '#3b82f6',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 13,
  },
  escalateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  escalateButtonText: {
    color: '#f97316',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 13,
  },
  adjusterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  adjusterHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  adjusterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  adjusterInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  adjusterInfo: {
    flex: 1,
    marginLeft: 12,
  },
  specialtyTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  specialtyTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specialtyTagText: {
    fontSize: 11,
    color: '#6b7280',
  },
  adjusterStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  adjusterStat: {
    flex: 1,
  },
  adjusterStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  adjusterStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  workloadBar: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    marginBottom: 4,
  },
  workloadFill: {
    height: '100%',
    borderRadius: 3,
  },
  workloadText: {
    fontSize: 12,
    color: '#6b7280',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 4,
  },
  assignButton: {
    backgroundColor: '#eff6ff',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  analyticsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  analyticsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  efficiencyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  efficiencyStat: {
    alignItems: 'center',
  },
  efficiencyValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#22c55e',
  },
  efficiencyLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  trendContainer: {
    gap: 12,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendLabel: {
    width: 70,
    fontSize: 12,
    color: '#6b7280',
  },
  trendBar: {
    flex: 1,
    height: 20,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    marginHorizontal: 8,
  },
  trendFill: {
    height: '100%',
    borderRadius: 4,
  },
  trendValue: {
    width: 60,
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'right',
  },
  categoryList: {
    gap: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  categoryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
});
