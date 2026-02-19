import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchReconciliationSummary } from '../../store/slices/reconciliationSlice';

export const ReconciliationDashboardScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const { summary } = useAppSelector(s => s.reconciliation);
  
  useEffect(() => { dispatch(fetchReconciliationSummary()); }, []);
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pending Reconciliations</Text>
        <Text style={styles.cardValue}>{summary?.pending || 0}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Discrepancies Found</Text>
        <Text style={[styles.cardValue, styles.warning]}>{summary?.discrepancies || 0}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Match Rate</Text>
        <Text style={[styles.cardValue, styles.success]}>{summary?.matchRate || 0}%</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('ReconciliationList')}>
        <Text style={styles.buttonText}>View All Reconciliations</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginBottom: 15 },
  cardTitle: { fontSize: 14, color: '#666', marginBottom: 10 },
  cardValue: { fontSize: 32, fontWeight: 'bold', color: '#333' },
  warning: { color: '#f59e0b' },
  success: { color: '#10b981' },
  button: { backgroundColor: '#667eea', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});