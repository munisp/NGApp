import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function P2PInsuranceScreen() {
  const pools = [
    { id: '1', name: 'Farmers Mutual', members: 156, poolSize: 2500000, premium: 5000, savings: 35 },
    { id: '2', name: 'Tech Workers Pool', members: 89, poolSize: 1800000, premium: 8000, savings: 28 },
    { id: '3', name: 'Market Traders', members: 234, poolSize: 3200000, premium: 3500, savings: 42 },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="account-group" size={32} color="#8b5cf6" />
        <Text style={styles.title}>P2P Insurance</Text>
        <Text style={styles.subtitle}>Community pools with shared risk</Text>
      </View>

      <View style={styles.infoCard}>
        <Icon name="information" size={24} color="#8b5cf6" />
        <Text style={styles.infoText}>
          Join a community pool to share risk with others like you. Lower premiums, transparent claims, and potential refunds!
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>479</Text>
          <Text style={styles.statLabel}>Total Members</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₦7.5M</Text>
          <Text style={styles.statLabel}>Total Pool</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>35%</Text>
          <Text style={styles.statLabel}>Avg Savings</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Available Pools</Text>
      {pools.map((pool) => (
        <TouchableOpacity key={pool.id} style={styles.poolCard}>
          <View style={styles.poolHeader}>
            <View style={styles.poolIcon}>
              <Icon name="shield-account" size={24} color="#8b5cf6" />
            </View>
            <View style={styles.poolInfo}>
              <Text style={styles.poolName}>{pool.name}</Text>
              <Text style={styles.poolMembers}>{pool.members} members</Text>
            </View>
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>Save {pool.savings}%</Text>
            </View>
          </View>
          <View style={styles.poolStats}>
            <View style={styles.poolStat}>
              <Text style={styles.poolStatLabel}>Pool Size</Text>
              <Text style={styles.poolStatValue}>₦{(pool.poolSize / 1000000).toFixed(1)}M</Text>
            </View>
            <View style={styles.poolStat}>
              <Text style={styles.poolStatLabel}>Monthly Premium</Text>
              <Text style={styles.poolStatValue}>₦{pool.premium.toLocaleString()}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.joinButton}>
            <Text style={styles.joinButtonText}>Join Pool</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  infoCard: { flexDirection: 'row', backgroundColor: '#f5f3ff', margin: 16, padding: 16, borderRadius: 12 },
  infoText: { flex: 1, fontSize: 14, color: '#6d28d9', marginLeft: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, marginHorizontal: 4, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#8b5cf6' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  poolCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16 },
  poolHeader: { flexDirection: 'row', alignItems: 'center' },
  poolIcon: { width: 48, height: 48, backgroundColor: '#f5f3ff', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  poolInfo: { flex: 1, marginLeft: 12 },
  poolName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  poolMembers: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  savingsBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  savingsText: { fontSize: 12, color: '#166534', fontWeight: '500' },
  poolStats: { flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  poolStat: { flex: 1 },
  poolStatLabel: { fontSize: 12, color: '#6b7280' },
  poolStatValue: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 2 },
  joinButton: { backgroundColor: '#8b5cf6', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  joinButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
