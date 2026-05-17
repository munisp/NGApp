import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function ParametricInsuranceScreen() {
  const products = [
    { id: '1', name: 'Weather-Indexed Crop', trigger: 'Rainfall < 50mm', payout: '₦500,000', premium: '₦15,000', icon: 'weather-rainy' },
    { id: '2', name: 'Flight Delay', trigger: 'Delay > 2 hours', payout: '₦50,000', premium: '₦2,500', icon: 'airplane' },
    { id: '3', name: 'Flood Insurance', trigger: 'Water level > 2m', payout: '₦1,000,000', premium: '₦25,000', icon: 'waves' },
    { id: '4', name: 'Earthquake', trigger: 'Magnitude > 5.0', payout: '₦2,000,000', premium: '₦35,000', icon: 'pulse' },
  ];

  const recentPayouts = [
    { id: '1', product: 'Flight Delay', amount: 50000, date: 'Jan 15, 2024', trigger: 'LOS-ABV delayed 3h' },
    { id: '2', product: 'Weather-Indexed', amount: 250000, date: 'Dec 20, 2023', trigger: 'Rainfall 32mm' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="cloud-sync" size={32} color="#06b6d4" />
        <Text style={styles.title}>Parametric Insurance</Text>
        <Text style={styles.subtitle}>Automatic payouts based on real-world data</Text>
      </View>

      <View style={styles.infoCard}>
        <Icon name="lightning-bolt" size={24} color="#06b6d4" />
        <Text style={styles.infoText}>
          No claims process needed! Payouts are automatic when trigger conditions are met based on verified data sources.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Available Products</Text>
      {products.map((product) => (
        <TouchableOpacity key={product.id} style={styles.productCard}>
          <View style={styles.productIcon}>
            <Icon name={product.icon} size={24} color="#06b6d4" />
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productTrigger}>Trigger: {product.trigger}</Text>
            <View style={styles.productDetails}>
              <Text style={styles.productPayout}>Payout: {product.payout}</Text>
              <Text style={styles.productPremium}>Premium: {product.premium}/yr</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={24} color="#9ca3af" />
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Recent Automatic Payouts</Text>
      {recentPayouts.map((payout) => (
        <View key={payout.id} style={styles.payoutCard}>
          <View style={styles.payoutHeader}>
            <Icon name="check-circle" size={24} color="#22c55e" />
            <View style={styles.payoutInfo}>
              <Text style={styles.payoutProduct}>{payout.product}</Text>
              <Text style={styles.payoutDate}>{payout.date}</Text>
            </View>
            <Text style={styles.payoutAmount}>₦{payout.amount.toLocaleString()}</Text>
          </View>
          <Text style={styles.payoutTrigger}>Trigger: {payout.trigger}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  infoCard: { flexDirection: 'row', backgroundColor: '#ecfeff', margin: 16, padding: 16, borderRadius: 12 },
  infoText: { flex: 1, fontSize: 14, color: '#0891b2', marginLeft: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  productIcon: { width: 48, height: 48, backgroundColor: '#ecfeff', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  productTrigger: { fontSize: 12, color: '#06b6d4', marginTop: 2 },
  productDetails: { flexDirection: 'row', marginTop: 4 },
  productPayout: { fontSize: 12, color: '#22c55e', marginRight: 12 },
  productPremium: { fontSize: 12, color: '#6b7280' },
  payoutCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 16 },
  payoutHeader: { flexDirection: 'row', alignItems: 'center' },
  payoutInfo: { flex: 1, marginLeft: 12 },
  payoutProduct: { fontSize: 14, fontWeight: '500', color: '#111827' },
  payoutDate: { fontSize: 12, color: '#6b7280' },
  payoutAmount: { fontSize: 16, fontWeight: 'bold', color: '#22c55e' },
  payoutTrigger: { fontSize: 12, color: '#6b7280', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
});
