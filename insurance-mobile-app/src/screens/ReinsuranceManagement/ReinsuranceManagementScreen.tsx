import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

interface Treaty {
  id: string;
  name: string;
  type: string;
  reinsurer: string;
  status: string;
  cessionRate?: number;
  retentionLimit?: number;
  coverageLimit: number;
  premiumCeded: number;
  claimsRecovered: number;
}

interface ClaimRecovery {
  id: string;
  claimId: string;
  grossClaim: number;
  recoveredAmount: number;
  treatyName: string;
  status: string;
}

const ReinsuranceManagementScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState('treaties');

  const treaties: Treaty[] = [
    {
      id: '1',
      name: 'Cyber Quota Share 2024',
      type: 'quota_share',
      reinsurer: 'Munich Re',
      status: 'active',
      cessionRate: 40,
      coverageLimit: 500000000,
      premiumCeded: 125000000,
      claimsRecovered: 45000000,
    },
    {
      id: '2',
      name: 'Property Excess of Loss',
      type: 'excess_of_loss',
      reinsurer: 'Swiss Re',
      status: 'active',
      retentionLimit: 100000000,
      coverageLimit: 1000000000,
      premiumCeded: 85000000,
      claimsRecovered: 120000000,
    },
    {
      id: '3',
      name: 'Catastrophe XOL Layer 1',
      type: 'catastrophe',
      reinsurer: "Lloyd's Syndicate 2623",
      status: 'active',
      retentionLimit: 500000000,
      coverageLimit: 2000000000,
      premiumCeded: 150000000,
      claimsRecovered: 0,
    },
    {
      id: '4',
      name: 'Health Excess of Loss',
      type: 'excess_of_loss',
      reinsurer: 'Gen Re',
      status: 'expiring',
      retentionLimit: 50000000,
      coverageLimit: 200000000,
      premiumCeded: 45000000,
      claimsRecovered: 15000000,
    },
  ];

  const claimRecoveries: ClaimRecovery[] = [
    { id: '1', claimId: 'CLM-2024-001234', grossClaim: 25000000, recoveredAmount: 10000000, treatyName: 'Cyber Quota Share', status: 'paid' },
    { id: '2', claimId: 'CLM-2024-001567', grossClaim: 150000000, recoveredAmount: 50000000, treatyName: 'Property XOL', status: 'approved' },
    { id: '3', claimId: 'CLM-2024-001890', grossClaim: 18000000, recoveredAmount: 7200000, treatyName: 'Cyber Quota Share', status: 'submitted' },
    { id: '4', claimId: 'CLM-2024-002123', grossClaim: 8000000, recoveredAmount: 2400000, treatyName: 'Motor Quota Share', status: 'pending' },
  ];

  const stats = {
    grossExposure: 14300000000,
    netExposure: 10100000000,
    cededExposure: 4200000000,
    premiumCeded: 575000000,
    claimsRecovered: 208000000,
    retentionRate: 70.6,
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000000) {
      return `₦${(amount / 1000000000).toFixed(1)}B`;
    } else if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(0)}M`;
    }
    return `₦${amount.toLocaleString()}`;
  };

  const getTreatyTypeLabel = (type: string) => {
    switch (type) {
      case 'quota_share': return 'Quota Share';
      case 'excess_of_loss': return 'Excess of Loss';
      case 'stop_loss': return 'Stop Loss';
      case 'catastrophe': return 'Catastrophe XOL';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'expiring': return '#F59E0B';
      case 'expired': return '#EF4444';
      case 'pending': return '#F59E0B';
      case 'submitted': return '#3B82F6';
      case 'approved': return '#8B5CF6';
      case 'paid': return '#10B981';
      default: return '#6B7280';
    }
  };

  const renderTreaties = () => (
    <View style={styles.section}>
      {treaties.map((treaty) => (
        <View 
          key={treaty.id} 
          style={[
            styles.treatyCard,
            treaty.status === 'expiring' && styles.expiringCard
          ]}
        >
          <View style={styles.treatyHeader}>
            <View style={styles.treatyInfo}>
              <Text style={styles.treatyName}>{treaty.name}</Text>
              <Text style={styles.reinsurerName}>{treaty.reinsurer}</Text>
            </View>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.badgeText, { color: '#4F46E5' }]}>
                  {getTreatyTypeLabel(treaty.type)}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${getStatusColor(treaty.status)}20` }]}>
                <Text style={[styles.badgeText, { color: getStatusColor(treaty.status) }]}>
                  {treaty.status}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.treatyDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>
                {treaty.type === 'quota_share' ? 'Cession Rate' : 'Retention'}
              </Text>
              <Text style={styles.detailValue}>
                {treaty.type === 'quota_share' 
                  ? `${treaty.cessionRate}%` 
                  : formatCurrency(treaty.retentionLimit || 0)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Coverage Limit</Text>
              <Text style={[styles.detailValue, { color: '#8B5CF6' }]}>
                {formatCurrency(treaty.coverageLimit)}
              </Text>
            </View>
          </View>

          <View style={styles.treatyFooter}>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Premium Ceded</Text>
              <Text style={[styles.footerValue, { color: '#F59E0B' }]}>
                {formatCurrency(treaty.premiumCeded)}
              </Text>
            </View>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Claims Recovered</Text>
              <Text style={[styles.footerValue, { color: '#10B981' }]}>
                {formatCurrency(treaty.claimsRecovered)}
              </Text>
            </View>
          </View>

          {treaty.status === 'expiring' && (
            <View style={styles.warningBanner}>
              <Icon name="alert-circle" size={16} color="#F59E0B" />
              <Text style={styles.warningText}>Expires in 60 days - Renewal required</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderExposures = () => (
    <View style={styles.section}>
      <View style={styles.exposureCard}>
        <Text style={styles.sectionTitle}>Exposure by Line of Business</Text>
        
        {[
          { line: 'Cyber Insurance', gross: 2500000000, net: 1500000000, retention: 60 },
          { line: 'Property Insurance', gross: 5000000000, net: 3500000000, retention: 70 },
          { line: 'Auto Insurance', gross: 1800000000, net: 1260000000, retention: 70 },
          { line: 'Health Insurance', gross: 1200000000, net: 960000000, retention: 80 },
        ].map((item, index) => (
          <View key={index} style={styles.exposureItem}>
            <View style={styles.exposureHeader}>
              <Text style={styles.exposureLine}>{item.line}</Text>
              <View style={[styles.badge, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.badgeText, { color: '#4F46E5' }]}>
                  {item.retention}% Retained
                </Text>
              </View>
            </View>
            
            <View style={styles.exposureValues}>
              <View style={styles.exposureValueItem}>
                <Text style={styles.exposureLabel}>Gross</Text>
                <Text style={styles.exposureValue}>{formatCurrency(item.gross)}</Text>
              </View>
              <View style={styles.exposureValueItem}>
                <Text style={styles.exposureLabel}>Net</Text>
                <Text style={[styles.exposureValue, { color: '#10B981' }]}>
                  {formatCurrency(item.net)}
                </Text>
              </View>
              <View style={styles.exposureValueItem}>
                <Text style={styles.exposureLabel}>Ceded</Text>
                <Text style={[styles.exposureValue, { color: '#8B5CF6' }]}>
                  {formatCurrency(item.gross - item.net)}
                </Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${item.retention}%`, backgroundColor: '#10B981' }]} />
              <View style={[styles.progressBar, { width: `${100 - item.retention}%`, backgroundColor: '#8B5CF6' }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderRecoveries = () => (
    <View style={styles.section}>
      {claimRecoveries.map((recovery) => (
        <View key={recovery.id} style={styles.recoveryCard}>
          <View style={styles.recoveryHeader}>
            <View>
              <Text style={styles.claimId}>{recovery.claimId}</Text>
              <Text style={styles.treatyRef}>{recovery.treatyName}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${getStatusColor(recovery.status)}20` }]}>
              <Text style={[styles.badgeText, { color: getStatusColor(recovery.status) }]}>
                {recovery.status}
              </Text>
            </View>
          </View>

          <View style={styles.recoveryDetails}>
            <View style={styles.recoveryItem}>
              <Text style={styles.recoveryLabel}>Gross Claim</Text>
              <Text style={styles.recoveryValue}>{formatCurrency(recovery.grossClaim)}</Text>
            </View>
            <View style={styles.recoveryItem}>
              <Text style={styles.recoveryLabel}>Recovery</Text>
              <Text style={[styles.recoveryValue, { color: '#10B981' }]}>
                {formatCurrency(recovery.recoveredAmount)}
              </Text>
            </View>
          </View>

          {recovery.status === 'pending' && (
            <TouchableOpacity style={styles.submitButton}>
              <Text style={styles.submitButtonText}>Submit to Reinsurer</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Icon name="umbrella" size={28} color="#4F46E5" />
          </View>
          <View>
            <Text style={styles.title}>Reinsurance Management</Text>
            <Text style={styles.subtitle}>Treaties, exposures & recoveries</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
            <Icon name="shield-check" size={24} color="#4F46E5" />
            <Text style={styles.statLabel}>Gross Exposure</Text>
            <Text style={[styles.statValue, { color: '#4F46E5' }]}>
              {formatCurrency(stats.grossExposure)}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
            <Icon name="target" size={24} color="#10B981" />
            <Text style={styles.statLabel}>Net Retention</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              {formatCurrency(stats.netExposure)}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F3E8FF' }]}>
            <Icon name="layers" size={24} color="#8B5CF6" />
            <Text style={styles.statLabel}>Ceded</Text>
            <Text style={[styles.statValue, { color: '#8B5CF6' }]}>
              {formatCurrency(stats.cededExposure)}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Icon name="percent" size={24} color="#F59E0B" />
            <Text style={styles.statLabel}>Retention Rate</Text>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>
              {stats.retentionRate}%
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: '#FFF7ED' }]}>
            <Text style={styles.summaryLabel}>Premium Ceded (YTD)</Text>
            <Text style={[styles.summaryValue, { color: '#EA580C' }]}>
              {formatCurrency(stats.premiumCeded)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#F0FDF4' }]}>
            <Text style={styles.summaryLabel}>Claims Recovered (YTD)</Text>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>
              {formatCurrency(stats.claimsRecovered)}
            </Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          {['treaties', 'exposures', 'recoveries'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Icon 
                name={tab === 'treaties' ? 'file-document' : tab === 'exposures' ? 'chart-pie' : 'cash-refund'} 
                size={18} 
                color={activeTab === tab ? '#4F46E5' : '#6B7280'} 
              />
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'treaties' && renderTreaties()}
        {activeTab === 'exposures' && renderExposures()}
        {activeTab === 'recoveries' && renderRecoveries()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  statCard: {
    width: (width - 48) / 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4F46E5',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  treatyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  expiringCard: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  treatyHeader: {
    marginBottom: 12,
  },
  treatyInfo: {
    marginBottom: 8,
  },
  treatyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  reinsurerName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  treatyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    marginTop: 2,
  },
  treatyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerItem: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  footerValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
  },
  exposureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exposureItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  exposureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exposureLine: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  exposureValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exposureValueItem: {
    flex: 1,
  },
  exposureLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  exposureValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  progressContainer: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  progressBar: {
    height: '100%',
  },
  recoveryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recoveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  claimId: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  treatyRef: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  recoveryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recoveryItem: {
    flex: 1,
  },
  recoveryLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  recoveryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ReinsuranceManagementScreen;
