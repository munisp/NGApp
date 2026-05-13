import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface Journey {
  id: number;
  name: string;
  description: string;
  category: 'onboarding' | 'payments' | 'operations' | 'analytics' | 'security';
  status: 'active' | 'pending' | 'completed' | 'failed';
  components: string[];
  successRate: number;
}

const journeys: Journey[] = [
  { id: 1, name: 'Admin Provision Organization', description: 'Admin logs in and provisions a new participant organization', category: 'onboarding', components: ['Keycloak', 'Permify', 'APISIX', 'Kafka', 'Lakehouse'], status: 'active', successRate: 98.5 },
  { id: 2, name: 'Participant KYB Activation', description: 'Participant completes KYB and is approved to join the network', category: 'onboarding', components: ['Ballerine', 'Docling', 'PaddleOCR', 'LLaVA', 'Compliance'], status: 'active', successRate: 94.2 },
  { id: 3, name: 'User KYC Product Access', description: 'Individual user completes KYC and is granted product access', category: 'onboarding', components: ['KYC', 'Identity Verification', 'AML', 'Permify'], status: 'active', successRate: 96.8 },
  { id: 4, name: 'Merchant POS Onboarding', description: 'Merchant onboarding + store creation + POS enablement', category: 'onboarding', components: ['KYB', 'Document Storage', 'POS Service', 'Sandbox', 'Dapr'], status: 'active', successRate: 92.1 },
  { id: 5, name: 'Developer Sandbox Access', description: 'Developer creates API token, gets metered access, tests in sandbox', category: 'onboarding', components: ['Monetization', 'Token', 'Metering', 'Sandbox', 'APISIX', 'Redis'], status: 'active', successRate: 99.1 },
  { id: 6, name: 'P2P Transfer Mojaloop', description: 'P2P transfer using Mojaloop APIs backed by TigerBeetle ledger', category: 'payments', components: ['Mojaloop', 'TigerBeetle', 'Fraud Detection', 'Kafka', 'Fluvio'], status: 'active', successRate: 99.7 },
  { id: 7, name: 'QR Code Payment', description: 'Merchant payment via QR code end-to-end', category: 'payments', components: ['QR Service', 'Payment Processing', 'TigerBeetle', 'Notifications'], status: 'active', successRate: 98.9 },
  { id: 8, name: 'Remittance FX Transfer', description: 'Remittance/FX transfer across corridors with FX risk checks', category: 'payments', components: ['Remittance', 'FX Risk', 'Routing', 'TigerBeetle', 'Compliance'], status: 'active', successRate: 97.3 },
  { id: 9, name: 'Dispute Chargeback', description: 'Dispute/chargeback lifecycle management', category: 'operations', components: ['Disputes', 'Document Storage', 'Compliance', 'TigerBeetle', 'Notifications'], status: 'active', successRate: 95.6 },
  { id: 10, name: 'Reconciliation', description: 'Compare ledger vs processor vs bank settlement', category: 'operations', components: ['Reconciliation', 'Lakehouse', 'TigerBeetle', 'Alerts'], status: 'active', successRate: 99.2 },
  { id: 11, name: 'Settlement Cycle', description: 'Settlement cycle and central bank reporting', category: 'operations', components: ['Settlement', 'Regulatory Reporting', 'TigerBeetle', 'RustFS'], status: 'active', successRate: 99.8 },
  { id: 12, name: 'Instant Settlement', description: 'Instant settlement path for eligible transactions', category: 'payments', components: ['Instant Settlement', 'TigerBeetle', 'Kafka', 'Fluvio'], status: 'active', successRate: 99.5 },
  { id: 13, name: 'Fraud Scoring Case Management', description: 'Fraud scoring at authorization time + case management', category: 'security', components: ['Fraud Detection (ML)', 'Rule Engine', 'AML Case Management'], status: 'active', successRate: 98.1 },
  { id: 14, name: 'Batch Analytics Pipeline', description: 'Batch analytics: daily metrics pipeline', category: 'analytics', components: ['Spark', 'Delta Lake', 'RustFS', 'Temporal Schedule'], status: 'active', successRate: 99.4 },
  { id: 15, name: 'Streaming Analytics Pipeline', description: 'Streaming analytics: domain events to Delta Lake', category: 'analytics', components: ['Kafka', 'Flink', 'Delta Lake', 'RustFS'], status: 'active', successRate: 99.6 },
  { id: 16, name: 'Webhook Integration', description: 'Webhook integration for external partners', category: 'operations', components: ['Webhooks', 'Retry Service', 'Idempotency', 'Audit'], status: 'active', successRate: 97.8 },
  { id: 17, name: 'Security Posture', description: 'Security posture journey: WAF policy + anomaly alerting', category: 'security', components: ['OpenAppSec', 'APISIX', 'Observability', 'Alerts'], status: 'active', successRate: 99.9 },
  { id: 18, name: 'DR Failover Drill', description: 'Disaster recovery failover drill', category: 'operations', components: ['DR Service', 'Health Checks', 'RustFS', 'Notifications'], status: 'active', successRate: 100 },
  { id: 19, name: 'Data Governance PII Masking', description: 'Data governance / PII masking workflow for analytics exports', category: 'analytics', components: ['PII Masking', 'Export', 'Permify', 'Compliance', 'RustFS'], status: 'active', successRate: 99.3 },
  { id: 20, name: 'Conformance Integration Testing', description: 'Conformance & integration testing journey', category: 'operations', components: ['Mojaloop Conformance', 'Integration Testing Portal', 'Sandbox'], status: 'active', successRate: 98.7 },
];

const categoryColors: Record<string, { bg: string; text: string }> = {
  onboarding: { bg: '#EBF5FF', text: '#1E40AF' },
  payments: { bg: '#ECFDF5', text: '#065F46' },
  operations: { bg: '#F5F3FF', text: '#5B21B6' },
  analytics: { bg: '#FFF7ED', text: '#C2410C' },
  security: { bg: '#FEF2F2', text: '#B91C1C' },
};

const statusColors: Record<string, string> = {
  active: '#22C55E',
  pending: '#EAB308',
  completed: '#3B82F6',
  failed: '#EF4444',
};

export default function JourneyScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const filteredJourneys = journeys.filter((journey) => {
    const matchesCategory = selectedCategory === 'all' || journey.category === selectedCategory;
    const matchesSearch = journey.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      journey.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['all', 'onboarding', 'payments', 'operations', 'analytics', 'security'];

  const handleRunJourney = (journeyId: number) => {
    console.log(`Running journey ${journeyId}`);
    // API call to trigger journey workflow
  };

  const renderJourneyCard = ({ item }: { item: Journey }) => {
    const colors = categoryColors[item.category];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedJourney(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]} />
            <Text style={styles.journeyId}>Journey {item.id}</Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.categoryText, { color: colors.text }]}>
              {item.category}
            </Text>
          </View>
        </View>

        <Text style={styles.journeyName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.journeyDescription} numberOfLines={2}>{item.description}</Text>

        <View style={styles.componentsContainer}>
          {item.components.slice(0, 3).map((component, idx) => (
            <View key={idx} style={styles.componentBadge}>
              <Text style={styles.componentText}>{component}</Text>
            </View>
          ))}
          {item.components.length > 3 && (
            <View style={styles.componentBadge}>
              <Text style={styles.componentText}>+{item.components.length - 3}</Text>
            </View>
          )}
        </View>

        <View style={styles.successRateContainer}>
          <View style={styles.successRateHeader}>
            <Text style={styles.successRateLabel}>Success Rate</Text>
            <Text style={styles.successRateValue}>{item.successRate}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${item.successRate}%` }]} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.runButton}
          onPress={() => handleRunJourney(item.id)}
        >
          <Text style={styles.runButtonText}>Run Journey</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>User Journeys</Text>
        <Text style={styles.subtitle}>Monitor and manage all 20 platform journeys</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search journeys..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryButtonText,
                selectedCategory === category && styles.categoryButtonTextActive,
              ]}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Journey List */}
      <FlatList
        data={filteredJourneys}
        renderItem={renderJourneyCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Journey Detail Modal */}
      {selectedJourney && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <View style={styles.modalHeaderBadges}>
                  <View style={[styles.statusDot, { backgroundColor: statusColors[selectedJourney.status] }]} />
                  <View style={[styles.categoryBadge, { backgroundColor: categoryColors[selectedJourney.category].bg }]}>
                    <Text style={[styles.categoryText, { color: categoryColors[selectedJourney.category].text }]}>
                      {selectedJourney.category}
                    </Text>
                  </View>
                </View>
                <Text style={styles.modalTitle}>
                  Journey {selectedJourney.id}: {selectedJourney.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedJourney(null)}>
                <Text style={styles.closeButton}>X</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>{selectedJourney.description}</Text>

            <Text style={styles.sectionTitle}>Integrated Components</Text>
            <View style={styles.modalComponentsContainer}>
              {selectedJourney.components.map((component, idx) => (
                <View key={idx} style={styles.modalComponentBadge}>
                  <Text style={styles.modalComponentText}>{component}</Text>
                </View>
              ))}
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Success Rate</Text>
                <Text style={styles.statValue}>{selectedJourney.successRate}%</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Status</Text>
                <Text style={[styles.statValue, { textTransform: 'capitalize' }]}>
                  {selectedJourney.status}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalRunButton}
                onPress={() => handleRunJourney(selectedJourney.id)}
              >
                <Text style={styles.modalRunButtonText}>Run Journey</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedJourney(null)}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
  },
  categoryScroll: {
    maxHeight: 50,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  journeyId: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  journeyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  journeyDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  componentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  componentBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  componentText: {
    fontSize: 12,
    color: '#4B5563',
  },
  successRateContainer: {
    marginBottom: 12,
  },
  successRateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  successRateLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  successRateValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 3,
  },
  runButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  runButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  modalComponentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  modalComponentBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalComponentText: {
    fontSize: 14,
    color: '#1E40AF',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalRunButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalRunButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
});
