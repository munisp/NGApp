import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
export const CustomerAnalyticsScreen = () => (
  <ScrollView style={styles.container}>
    <View style={styles.card}><Text style={styles.title}>Total Customers</Text><Text style={styles.value}>1,234</Text></View>
    <View style={styles.card}><Text style={styles.title}>Active This Month</Text><Text style={styles.value}>856</Text></View>
  </ScrollView>
);
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginBottom: 15 },
  title: { fontSize: 14, color: '#666', marginBottom: 10 },
  value: { fontSize: 24, fontWeight: 'bold' },
});