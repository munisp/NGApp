import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';

interface FraudRing {
  id: string;
  name: string;
  memberCount: number;
  totalAmount: number;
  riskScore: number;
  status: 'active' | 'investigating' | 'resolved';
  sharedAttributes: string[];
}

interface FraudAlert {
  id: string;
  entityName: string;
  alertType: string;
  riskScore: number;
  timestamp: string;
  status: 'new' | 'reviewing' | 'escalated';
}

const { width: screenWidth } = Dimensions.get('window');

export default function FraudNetworkScreen() {
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'rings' | 'alerts'>('rings');
  const [fraudRings, setFraudRings] = useState<FraudRing[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    setFraudRings([
      {
        id: 'FR001',
        name: 'Victoria Island Network',
        memberCount: 4,
        totalAmount: 4500000,
        riskScore: 0.85,
        status: 'investigating',
        sharedAttributes: ['Same Address', 'Same Agent'],
      },
      {
        id: 'FR002',
        name: 'Ikeja Claims Ring',
        memberCount: 3,
        totalAmount: 3900000,
        riskScore: 0.72,
        status: 'active',
        sharedAttributes: ['Same Phone', 'Sequential Policies'],
      },
      {
        id: 'FR003',
        name: 'Abuja Medical Claims',
        memberCount: 3,
        totalAmount: 8500000,
        riskScore: 0.88,
        status: 'escalated',
        sharedAttributes: ['Same Provider', 'Inflated Claims'],
      },
    ]);

    setAlerts([
      {
        id: 'A001',
        entityName: 'John Doe',
        alertType: 'Unusual Claim Pattern',
        riskScore: 0.78,
        timestamp: '10:30 AM',
        status: 'new',
      },
      {
        id: 'A002',
        entityName: 'Jane Smith',
        alertType: 'Network Connection',
        riskScore: 0.65,
        timestamp: '9:15 AM',
        status: 'reviewing',
      },
      {
        id: 'A003',
        entityName: 'Quick Insurance Agency',
        alertType: 'High Claim Ratio',
        riskScore: 0.72,
        timestamp: 'Yesterday',
        status: 'escalated',
      },
    ]);

    setLoading(false);
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.8) return '#EF4444';
    if (score >= 0.6) return '#F97316';
    if (score >= 0.4) return '#EAB308';
    return '#10B981';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'new':
        return '#EF4444';
      case 'investigating':
      case 'reviewing':
        return '#F59E0B';
      case 'escalated':
        return '#F97316';
      case 'resolved':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${(amount / 1000000).toFixed(1)}M`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading fraud data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fraud Network</Text>
        <Text style={styles.subtitle}>AI-Powered Detection</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{fraudRings.length}</Text>
          <Text style={styles.statLabel}>Active Rings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {fraudRings.reduce((acc, r) => acc + r.memberCount, 0)}
          </Text>
          <Text style={styles.statLabel}>Entities</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#EF4444' }]}>
            {alerts.filter(a => a.status === 'new').length}
          </Text>
          <Text style={styles.statLabel}>New Alerts</Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'rings' && styles.activeTab]}
          onPress={() => setSelectedTab('rings')}
        >
          <Text style={[styles.tabText, selectedTab === 'rings' && styles.activeTabText]}>
            Fraud Rings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'alerts' && styles.activeTab]}
          onPress={() => setSelectedTab('alerts')}
        >
          <Text style={[styles.tabText, selectedTab === 'alerts' && styles.activeTabText]}>
            Alerts
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {selectedTab === 'rings' ? (
          <>
            {fraudRings.map((ring) => (
              <TouchableOpacity key={ring.id} style={styles.ringCard}>
                <View style={styles.ringHeader}>
                  <View>
                    <Text style={styles.ringName}>{ring.name}</Text>
                    <Text style={styles.ringId}>ID: {ring.id}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ring.status) }]}>
                    <Text style={styles.statusText}>{ring.status}</Text>
                  </View>
                </View>

                <View style={styles.ringStats}>
                  <View style={styles.ringStat}>
                    <Text style={styles.ringStatValue}>{ring.memberCount}</Text>
                    <Text style={styles.ringStatLabel}>Members</Text>
                  </View>
                  <View style={styles.ringStat}>
                    <Text style={styles.ringStatValue}>{formatCurrency(ring.totalAmount)}</Text>
                    <Text style={styles.ringStatLabel}>Amount</Text>
                  </View>
                  <View style={styles.ringStat}>
                    <Text style={[styles.ringStatValue, { color: getRiskColor(ring.riskScore) }]}>
                      {(ring.riskScore * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.ringStatLabel}>Risk</Text>
                  </View>
                </View>

                <View style={styles.riskBar}>
                  <View
                    style={[
                      styles.riskBarFill,
                      {
                        width: `${ring.riskScore * 100}%`,
                        backgroundColor: getRiskColor(ring.riskScore),
                      },
                    ]}
                  />
                </View>

                <View style={styles.attributesContainer}>
                  {ring.sharedAttributes.map((attr, idx) => (
                    <View key={idx} style={styles.attributeBadge}>
                      <Text style={styles.attributeText}>{attr}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.networkVisualization}>
              <Text style={styles.sectionTitle}>Network Visualization</Text>
              <Svg width={screenWidth - 64} height={200}>
                <Circle cx={80} cy={100} r={20} fill="#EF4444" />
                <Circle cx={160} cy={60} r={20} fill="#F97316" />
                <Circle cx={160} cy={140} r={20} fill="#F97316" />
                <Circle cx={240} cy={100} r={20} fill="#EAB308" />
                
                <Line x1={80} y1={100} x2={160} y2={60} stroke="#EF4444" strokeWidth={2} strokeDasharray="5,5" />
                <Line x1={80} y1={100} x2={160} y2={140} stroke="#EF4444" strokeWidth={2} strokeDasharray="5,5" />
                <Line x1={160} y1={60} x2={240} y2={100} stroke="#F97316" strokeWidth={2} strokeDasharray="5,5" />
                <Line x1={160} y1={140} x2={240} y2={100} stroke="#F97316" strokeWidth={2} strokeDasharray="5,5" />
                <Line x1={160} y1={60} x2={160} y2={140} stroke="#EF4444" strokeWidth={2} strokeDasharray="5,5" />
                
                <SvgText x={80} y={135} fontSize="10" fill="#374151" textAnchor="middle">High Risk</SvgText>
                <SvgText x={160} y={175} fontSize="10" fill="#374151" textAnchor="middle">Connected</SvgText>
                <SvgText x={240} y={135} fontSize="10" fill="#374151" textAnchor="middle">Medium</SvgText>
              </Svg>
            </View>
          </>
        ) : (
          <>
            {alerts.map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <View style={[styles.alertIcon, { backgroundColor: getRiskColor(alert.riskScore) + '20' }]}>
                    <Text style={[styles.alertIconText, { color: getRiskColor(alert.riskScore) }]}>!</Text>
                  </View>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertName}>{alert.entityName}</Text>
                    <Text style={styles.alertType}>{alert.alertType}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(alert.status) }]}>
                    <Text style={styles.statusText}>{alert.status}</Text>
                  </View>
                </View>
                <View style={styles.alertFooter}>
                  <View style={[styles.riskBadge, { backgroundColor: getRiskColor(alert.riskScore) }]}>
                    <Text style={styles.riskBadgeText}>{(alert.riskScore * 100).toFixed(0)}% Risk</Text>
                  </View>
                  <Text style={styles.alertTimestamp}>{alert.timestamp}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  ringCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ringHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ringName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  ringId: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  ringStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  ringStat: {
    alignItems: 'center',
  },
  ringStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  ringStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  riskBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 12,
  },
  riskBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  attributesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attributeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  attributeText: {
    fontSize: 11,
    color: '#374151',
  },
  networkVisualization: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertIconText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  alertInfo: {
    flex: 1,
  },
  alertName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  alertType: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  riskBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  alertTimestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
