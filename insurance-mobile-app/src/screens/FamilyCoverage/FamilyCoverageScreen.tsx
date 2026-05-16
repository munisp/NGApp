import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function FamilyCoverageScreen() {
  const familyMembers = [
    { id: '1', name: 'John Adeyemi', relation: 'Self', age: 35, policies: 4, coverage: 15000000, avatar: 'JA' },
    { id: '2', name: 'Sarah Adeyemi', relation: 'Spouse', age: 32, policies: 3, coverage: 12000000, avatar: 'SA' },
    { id: '3', name: 'David Adeyemi', relation: 'Son', age: 8, policies: 2, coverage: 5000000, avatar: 'DA' },
    { id: '4', name: 'Grace Adeyemi', relation: 'Daughter', age: 5, policies: 2, coverage: 5000000, avatar: 'GA' },
  ];

  const coverageGaps = [
    { id: '1', type: 'Critical Illness', recommendation: 'Add coverage for spouse', priority: 'high' },
    { id: '2', type: 'Education Fund', recommendation: 'Start education savings for children', priority: 'medium' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="account-group" size={32} color="#8b5cf6" />
        <Text style={styles.title}>Family Coverage</Text>
        <Text style={styles.subtitle}>Unified view of all family policies</Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Family Coverage</Text>
        <Text style={styles.totalValue}>₦37,000,000</Text>
        <View style={styles.totalStats}>
          <View style={styles.totalStat}>
            <Text style={styles.statValue}>4</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.totalStat}>
            <Text style={styles.statValue}>11</Text>
            <Text style={styles.statLabel}>Policies</Text>
          </View>
          <View style={styles.totalStat}>
            <Text style={styles.statValue}>₦45K</Text>
            <Text style={styles.statLabel}>Monthly</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Family Members</Text>
      {familyMembers.map((member) => (
        <TouchableOpacity key={member.id} style={styles.memberCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{member.avatar}</Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberRelation}>{member.relation} • {member.age} years</Text>
            <View style={styles.memberStats}>
              <Text style={styles.memberPolicies}>{member.policies} policies</Text>
              <Text style={styles.memberCoverage}>₦{(member.coverage / 1000000).toFixed(0)}M coverage</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={24} color="#9ca3af" />
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Coverage Gaps</Text>
      {coverageGaps.map((gap) => (
        <View key={gap.id} style={styles.gapCard}>
          <View style={[styles.priorityIndicator, gap.priority === 'high' ? styles.highPriority : styles.mediumPriority]} />
          <View style={styles.gapInfo}>
            <Text style={styles.gapType}>{gap.type}</Text>
            <Text style={styles.gapRecommendation}>{gap.recommendation}</Text>
          </View>
          <TouchableOpacity style={styles.addButton}>
            <Icon name="plus" size={20} color="#8b5cf6" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addMemberButton}>
        <Icon name="account-plus" size={20} color="#fff" />
        <Text style={styles.addMemberText}>Add Family Member</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  totalCard: { backgroundColor: '#8b5cf6', margin: 16, padding: 20, borderRadius: 16 },
  totalLabel: { fontSize: 14, color: '#e9d5ff' },
  totalValue: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  totalStats: { flexDirection: 'row', marginTop: 16 },
  totalStat: { flex: 1 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#e9d5ff' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: '#8b5cf6' },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  memberRelation: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  memberStats: { flexDirection: 'row', marginTop: 4 },
  memberPolicies: { fontSize: 12, color: '#8b5cf6', marginRight: 12 },
  memberCoverage: { fontSize: 12, color: '#22c55e' },
  gapCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  priorityIndicator: { width: 4, height: 40, borderRadius: 2, marginRight: 12 },
  highPriority: { backgroundColor: '#ef4444' },
  mediumPriority: { backgroundColor: '#f59e0b' },
  gapInfo: { flex: 1 },
  gapType: { fontSize: 14, fontWeight: '500', color: '#111827' },
  gapRecommendation: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' },
  addMemberButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#8b5cf6', margin: 16, padding: 16, borderRadius: 12 },
  addMemberText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
});
