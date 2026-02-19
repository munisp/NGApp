import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
export const FraudDetectionScreen = () => (
  <ScrollView style={styles.container}>
    <View style={styles.card}><Text style={styles.title}>Suspicious Activities</Text><Text style={styles.count}>2 alerts</Text></View>
    <View style={styles.card}><Text style={styles.title}>Risk Score</Text><Text style={[styles.count, styles.low]}>Low</Text></View>
  </ScrollView>
);
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginBottom: 15 },
  title: { fontSize: 14, color: '#666', marginBottom: 10 },
  count: { fontSize: 24, fontWeight: 'bold', color: '#ef4444' },
  low: { color: '#10b981' },
});