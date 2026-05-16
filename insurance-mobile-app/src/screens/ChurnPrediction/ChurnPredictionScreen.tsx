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

interface AtRiskCustomer {
  id: string;
  name: string;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  policyType: string;
  lastActivity: string;
  factors: string[];
}

const metrics = {
  totalCustomers: 15847,
  atRisk: 1243,
  churnRate: 7.8,
  predictedChurn: 312,
  savedThisMonth: 89,
  revenueAtRisk: 45600000,
};

const riskDistribution = [
  { level: 'Critical', count: 156, percentage: 12.5, color: '#ef4444' },
  { level: 'High', count: 387, percentage: 31.1, color: '#f97316' },
  { level: 'Medium', count: 458, percentage: 36.9, color: '#eab308' },
  { level: 'Low', count: 242, percentage: 19.5, color: '#22c55e' },
];

const atRiskCustomers: AtRiskCustomer[] = [
  {
    id: '1',
    name: 'Adebayo Enterprises',
    riskScore: 92,
    riskLevel: 'critical',
    policyType: 'Commercial Auto',
    lastActivity: '45 days ago',
    factors: ['No recent engagement', 'Premium increase', 'Competitor inquiry'],
  },
  {
    id: '2',
    name: 'Ngozi Okonkwo',
    riskScore: 78,
    riskLevel: 'high',
    policyType: 'Health Insurance',
    lastActivity: '30 days ago',
    factors: ['Claim denied', 'Support tickets'],
  },
  {
    id: '3',
    name: 'Lagos Fresh Farms',
    riskScore: 65,
    riskLevel: 'medium',
    policyType: 'Crop Insurance',
    lastActivity: '21 days ago',
    factors: ['Payment delay', 'Coverage questions'],
  },
];

export default function ChurnPredictionScreen() {
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'actions'>('overview');

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return '#ef4444';
      case 'high':
        return '#f97316';
      case 'medium':
        return '#eab308';
      case 'low':
        return '#22c55e';
      default:
        return '#6b7280';
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${(amount / 1000000).toFixed(1)}M`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Churn Prediction</Text>
        <TouchableOpacity style={styles.refreshButton}>
          <Icon name="refresh" size={20} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Icon name="account-group" size={24} color="#3b82f6" />
            <Text style={styles.metricValue}>{metrics.totalCustomers.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Total Customers</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardWarning]}>
            <Icon name="alert-triangle" size={24} color="#f97316" />
            <Text style={[styles.metricValue, { color: '#f97316' }]}>{metrics.atRisk.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>At Risk</Text>
          </View>
          <View style={styles.metricCard}>
            <Icon name="trending-down" size={24} color="#ef4444" />
            <Text style={styles.metricValue}>{metrics.churnRate}%</Text>
            <Text style={styles.metricLabel}>Churn Rate</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardSuccess]}>
            <Icon name="account-check" size={24} color="#22c55e" />
            <Text style={[styles.metricValue, { color: '#22c55e' }]}>{metrics.savedThisMonth}</Text>
            <Text style={styles.metricLabel}>Saved This Month</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          {['overview', 'customers', 'actions'].map((tab) => (
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
            <Text style={styles.sectionTitle}>Risk Distribution</Text>
            <View style={styles.riskDistribution}>
              {riskDistribution.map((item) => (
                <View key={item.level} style={styles.riskItem}>
                  <View style={styles.riskHeader}>
                    <View style={[styles.riskDot, { backgroundColor: item.color }]} />
                    <Text style={styles.riskLevel}>{item.level} Risk</Text>
                  </View>
                  <View style={styles.riskBarContainer}>
                    <View
                      style={[
                        styles.riskBar,
                        { width: `${item.percentage}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                  <Text style={styles.riskCount}>
                    {item.count} customers ({item.percentage}%)
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.revenueCard}>
              <Icon name="currency-ngn" size={32} color="#ef4444" />
              <View style={styles.revenueInfo}>
                <Text style={styles.revenueLabel}>Revenue at Risk</Text>
                <Text style={styles.revenueValue}>{formatCurrency(metrics.revenueAtRisk)}</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'customers' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>At-Risk Customers</Text>
            {atRiskCustomers.map((customer) => (
              <View key={customer.id} style={styles.customerCard}>
                <View style={styles.customerHeader}>
                  <View>
                    <Text style={styles.customerName}>{customer.name}</Text>
                    <Text style={styles.customerPolicy}>{customer.policyType}</Text>
                  </View>
                  <View
                    style={[
                      styles.riskBadge,
                      { backgroundColor: getRiskColor(customer.riskLevel) + '20' },
                    ]}
                  >
                    <Text
                      style={[styles.riskBadgeText, { color: getRiskColor(customer.riskLevel) }]}
                    >
                      {customer.riskScore}% Risk
                    </Text>
                  </View>
                </View>
                <View style={styles.customerFactors}>
                  {customer.factors.map((factor, index) => (
                    <View key={index} style={styles.factorTag}>
                      <Text style={styles.factorText}>{factor}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.customerActions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Icon name="phone" size={16} color="#3b82f6" />
                    <Text style={styles.actionButtonText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Icon name="email" size={16} color="#3b82f6" />
                    <Text style={styles.actionButtonText}>Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.actionButtonPrimary]}>
                    <Icon name="gift" size={16} color="#ffffff" />
                    <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>Offer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'actions' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended Actions</Text>
            <View style={styles.actionCard}>
              <View style={styles.actionCardHeader}>
                <Icon name="phone-outgoing" size={24} color="#ef4444" />
                <Text style={styles.actionCardTitle}>Urgent Callbacks</Text>
              </View>
              <Text style={styles.actionCardCount}>23</Text>
              <Text style={styles.actionCardDesc}>Critical risk customers need immediate attention</Text>
              <TouchableOpacity style={styles.actionCardButton}>
                <Text style={styles.actionCardButtonText}>View List</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionCard}>
              <View style={styles.actionCardHeader}>
                <Icon name="gift" size={24} color="#22c55e" />
                <Text style={styles.actionCardTitle}>Retention Offers</Text>
              </View>
              <Text style={styles.actionCardCount}>156</Text>
              <Text style={styles.actionCardDesc}>Customers eligible for loyalty discounts</Text>
              <TouchableOpacity style={styles.actionCardButton}>
                <Text style={styles.actionCardButtonText}>Send Offers</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionCard}>
              <View style={styles.actionCardHeader}>
                <Icon name="email-send" size={24} color="#3b82f6" />
                <Text style={styles.actionCardTitle}>Re-engagement</Text>
              </View>
              <Text style={styles.actionCardCount}>89</Text>
              <Text style={styles.actionCardDesc}>Inactive customers to re-engage</Text>
              <TouchableOpacity style={styles.actionCardButton}>
                <Text style={styles.actionCardButtonText}>Start Campaign</Text>
              </TouchableOpacity>
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
  refreshButton: {
    padding: 8,
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
    padding: 16,
    alignItems: 'center',
  },
  metricCardWarning: {
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  metricCardSuccess: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 8,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  riskDistribution: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  riskItem: {
    marginBottom: 16,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  riskDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  riskLevel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  riskBarContainer: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    marginBottom: 4,
  },
  riskBar: {
    height: '100%',
    borderRadius: 4,
  },
  riskCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  revenueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  revenueInfo: {
    marginLeft: 16,
  },
  revenueLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  revenueValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ef4444',
  },
  customerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  customerPolicy: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customerFactors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  factorTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  factorText: {
    fontSize: 11,
    color: '#6b7280',
  },
  customerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonPrimary: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 13,
    color: '#3b82f6',
  },
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
  },
  actionCardCount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
  },
  actionCardDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 12,
  },
  actionCardButton: {
    backgroundColor: '#eff6ff',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionCardButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
});
