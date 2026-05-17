import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface ModelStatus {
  name: string;
  robustnessScore: number;
  status: 'hardened' | 'protected' | 'vulnerable';
  lastTested: string;
}

interface AttackLog {
  time: string;
  type: string;
  target: string;
  status: 'blocked' | 'detected';
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export default function ModelSecurityScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'attacks'>('overview');

  const models: ModelStatus[] = [
    { name: 'Fraud Detection', robustnessScore: 0.87, status: 'hardened', lastTested: '2h ago' },
    { name: 'Risk Scoring', robustnessScore: 0.79, status: 'protected', lastTested: '4h ago' },
    { name: 'Claims Prediction', robustnessScore: 0.68, status: 'vulnerable', lastTested: '6h ago' },
    { name: 'Premium Pricing', robustnessScore: 0.83, status: 'protected', lastTested: '3h ago' },
  ];

  const attackLogs: AttackLog[] = [
    { time: '2 min ago', type: 'FGSM', target: 'Fraud Detection', status: 'blocked', severity: 'medium' },
    { time: '15 min ago', type: 'PGD', target: 'Risk Scoring', status: 'blocked', severity: 'high' },
    { time: '1 hour ago', type: 'Input Manipulation', target: 'Claims Model', status: 'detected', severity: 'low' },
    { time: '3 hours ago', type: 'Data Poisoning', target: 'Training Pipeline', status: 'blocked', severity: 'critical' },
  ];

  const overallRobustness = models.reduce((sum, m) => sum + m.robustnessScore, 0) / models.length;

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hardened': return '#22c55e';
      case 'protected': return '#3b82f6';
      case 'vulnerable': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const renderOverview = () => (
    <View style={styles.section}>
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { backgroundColor: overallRobustness >= 0.8 ? '#dcfce7' : overallRobustness >= 0.7 ? '#fef9c3' : '#fee2e2' }]}>
          <Icon name="shield-check" size={28} color={overallRobustness >= 0.8 ? '#16a34a' : overallRobustness >= 0.7 ? '#ca8a04' : '#dc2626'} />
          <Text style={styles.metricValue}>{(overallRobustness * 100).toFixed(0)}%</Text>
          <Text style={styles.metricLabel}>Overall Robustness</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#dbeafe' }]}>
          <Icon name="lock" size={28} color="#2563eb" />
          <Text style={styles.metricValue}>74%</Text>
          <Text style={styles.metricLabel}>Defense Effectiveness</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#f3e8ff' }]}>
          <Icon name="brain" size={28} color="#9333ea" />
          <Text style={styles.metricValue}>{models.filter(m => m.status !== 'vulnerable').length}/{models.length}</Text>
          <Text style={styles.metricLabel}>Models Protected</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#ffedd5' }]}>
          <Icon name="alert-circle" size={28} color="#ea580c" />
          <Text style={styles.metricValue}>{attackLogs.filter(a => a.severity === 'critical' || a.severity === 'high').length}</Text>
          <Text style={styles.metricLabel}>Active Threats</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Icon name="information" size={20} color="#3b82f6" />
          <Text style={styles.infoTitle}>How AI Model Security Works</Text>
        </View>
        <Text style={styles.infoText}>
          Our AI models are protected against adversarial attacks using the Adversarial Robustness Toolbox (ART). 
          This ensures fraudsters cannot manipulate inputs to bypass fraud detection or risk scoring.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      {attackLogs.slice(0, 3).map((log, idx) => (
        <View key={idx} style={styles.activityItem}>
          <View style={[styles.activityIcon, { backgroundColor: log.status === 'blocked' ? '#dcfce7' : '#fef9c3' }]}>
            <Icon 
              name={log.status === 'blocked' ? 'shield-check' : 'eye'} 
              size={18} 
              color={log.status === 'blocked' ? '#16a34a' : '#ca8a04'} 
            />
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityText}>{log.type} on {log.target}</Text>
            <Text style={styles.activityTime}>{log.time}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(log.severity) + '20' }]}>
            <Text style={[styles.severityText, { color: getSeverityColor(log.severity) }]}>{log.severity}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderModels = () => (
    <View style={styles.section}>
      {models.map((model, idx) => (
        <View key={idx} style={[styles.modelCard, { borderLeftColor: getStatusColor(model.status) }]}>
          <View style={styles.modelHeader}>
            <Text style={styles.modelName}>{model.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(model.status) }]}>
              <Text style={styles.statusText}>{model.status}</Text>
            </View>
          </View>
          <View style={styles.modelMetrics}>
            <View style={styles.modelMetric}>
              <Text style={styles.modelMetricLabel}>Robustness</Text>
              <Text style={styles.modelMetricValue}>{(model.robustnessScore * 100).toFixed(0)}%</Text>
            </View>
            <View style={styles.modelMetric}>
              <Text style={styles.modelMetricLabel}>Last Tested</Text>
              <Text style={styles.modelMetricValue}>{model.lastTested}</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${model.robustnessScore * 100}%`, backgroundColor: getStatusColor(model.status) }]} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderAttacks = () => (
    <View style={styles.section}>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
          <Text style={styles.statValue}>12,847</Text>
          <Text style={styles.statLabel}>Requests Today</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
          <Text style={styles.statValue}>11</Text>
          <Text style={styles.statLabel}>Blocked</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Attack Log</Text>
      {attackLogs.map((log, idx) => (
        <View key={idx} style={styles.attackItem}>
          <View style={[styles.attackIcon, { backgroundColor: log.status === 'blocked' ? '#dcfce7' : '#fef9c3' }]}>
            <Icon 
              name={log.status === 'blocked' ? 'shield-off' : 'eye-outline'} 
              size={20} 
              color={log.status === 'blocked' ? '#16a34a' : '#ca8a04'} 
            />
          </View>
          <View style={styles.attackContent}>
            <Text style={styles.attackType}>{log.type}</Text>
            <Text style={styles.attackTarget}>Target: {log.target}</Text>
            <Text style={styles.attackTime}>{log.time}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(log.severity) + '20' }]}>
            <Text style={[styles.severityText, { color: getSeverityColor(log.severity) }]}>{log.severity}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Icon name="shield-lock" size={28} color="#3b82f6" />
        <Text style={styles.headerTitle}>AI Model Security</Text>
      </View>

      <View style={styles.tabs}>
        {(['overview', 'models', 'attacks'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Icon 
              name={tab === 'overview' ? 'view-dashboard' : tab === 'models' ? 'brain' : 'alert-circle'} 
              size={18} 
              color={activeTab === tab ? '#3b82f6' : '#6b7280'} 
            />
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'models' && renderModels()}
        {activeTab === 'attacks' && renderAttacks()}
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
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
    color: '#1e293b',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#eff6ff',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6b7280',
  },
  activeTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  metricCard: {
    width: '48%',
    margin: '1%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#3b82f6',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 20,
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityText: {
    fontSize: 14,
    color: '#1e293b',
  },
  activityTime: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  modelCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  modelMetrics: {
    flexDirection: 'row',
    marginTop: 12,
  },
  modelMetric: {
    marginRight: 24,
  },
  modelMetricLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  modelMetricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 2,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  attackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  attackIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attackContent: {
    flex: 1,
    marginLeft: 12,
  },
  attackType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  attackTarget: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  attackTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
