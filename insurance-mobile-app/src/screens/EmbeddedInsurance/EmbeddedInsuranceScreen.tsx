import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function EmbeddedInsuranceScreen() {
  const apiStats = {
    totalCalls: 125000,
    successRate: 99.8,
    avgLatency: 145,
    activePartners: 24,
  };

  const partners = [
    { id: '1', name: 'Jumia', type: 'E-commerce', products: ['Device', 'Delivery'], status: 'active' },
    { id: '2', name: 'Bolt', type: 'Ride-hailing', products: ['Trip', 'Driver'], status: 'active' },
    { id: '3', name: 'Paystack', type: 'Fintech', products: ['Transaction', 'Fraud'], status: 'active' },
    { id: '4', name: 'Konga', type: 'E-commerce', products: ['Device', 'Extended Warranty'], status: 'pending' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="api" size={32} color="#6366f1" />
        <Text style={styles.title}>Embedded Insurance</Text>
        <Text style={styles.subtitle}>B2B2C API Portal</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{(apiStats.totalCalls / 1000).toFixed(0)}K</Text>
          <Text style={styles.statLabel}>API Calls</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{apiStats.successRate}%</Text>
          <Text style={styles.statLabel}>Success Rate</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{apiStats.avgLatency}ms</Text>
          <Text style={styles.statLabel}>Avg Latency</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{apiStats.activePartners}</Text>
          <Text style={styles.statLabel}>Partners</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Icon name="information" size={24} color="#6366f1" />
        <Text style={styles.infoText}>
          Integrate insurance at checkout with our simple API. Offer device protection, travel insurance, and more to your customers.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Partner Integrations</Text>
      {partners.map((partner) => (
        <View key={partner.id} style={styles.partnerCard}>
          <View style={styles.partnerLogo}>
            <Text style={styles.partnerInitial}>{partner.name[0]}</Text>
          </View>
          <View style={styles.partnerInfo}>
            <View style={styles.partnerHeader}>
              <Text style={styles.partnerName}>{partner.name}</Text>
              <View style={[styles.statusBadge, partner.status === 'active' ? styles.activeBadge : styles.pendingBadge]}>
                <Text style={[styles.statusText, partner.status === 'active' ? styles.activeText : styles.pendingText]}>
                  {partner.status}
                </Text>
              </View>
            </View>
            <Text style={styles.partnerType}>{partner.type}</Text>
            <View style={styles.productsRow}>
              {partner.products.map((product, i) => (
                <View key={i} style={styles.productBadge}>
                  <Text style={styles.productText}>{product}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.docsButton}>
        <Icon name="file-document" size={20} color="#fff" />
        <Text style={styles.docsButtonText}>View API Documentation</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12 },
  statCard: { width: '48%', backgroundColor: '#fff', padding: 16, margin: '1%', borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#6366f1' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  infoCard: { flexDirection: 'row', backgroundColor: '#eef2ff', margin: 16, padding: 16, borderRadius: 12 },
  infoText: { flex: 1, fontSize: 14, color: '#4338ca', marginLeft: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  partnerCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  partnerLogo: { width: 48, height: 48, backgroundColor: '#eef2ff', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  partnerInitial: { fontSize: 20, fontWeight: 'bold', color: '#6366f1' },
  partnerInfo: { flex: 1, marginLeft: 12 },
  partnerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partnerName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  activeBadge: { backgroundColor: '#dcfce7' },
  pendingBadge: { backgroundColor: '#fef3c7' },
  statusText: { fontSize: 10, fontWeight: '500' },
  activeText: { color: '#166534' },
  pendingText: { color: '#d97706' },
  partnerType: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  productsRow: { flexDirection: 'row', marginTop: 8 },
  productBadge: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 4 },
  productText: { fontSize: 10, color: '#6b7280' },
  docsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', margin: 16, padding: 16, borderRadius: 12 },
  docsButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
});
