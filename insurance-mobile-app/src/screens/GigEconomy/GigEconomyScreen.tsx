import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function GigEconomyScreen() {
  const [onDemandActive, setOnDemandActive] = useState(true);

  const products = [
    { id: '1', name: 'Delivery Rider Protection', price: '₦50-150/trip', icon: 'bike', popular: true },
    { id: '2', name: 'Ride-Share Driver Insurance', price: '₦200-500/trip', icon: 'car', popular: true },
    { id: '3', name: 'Freelancer Professional Liability', price: 'From ₦5,000/mo', icon: 'laptop', popular: false },
    { id: '4', name: 'Artisan & Tradesperson Cover', price: '₦100-300/job', icon: 'wrench', popular: false },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="lightning-bolt" size={32} color="#f97316" />
        <Text style={styles.title}>Gig Economy Insurance</Text>
        <Text style={styles.subtitle}>Flexible, on-demand coverage</Text>
      </View>

      <View style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>On-Demand Mode</Text>
          <Switch value={onDemandActive} onValueChange={setOnDemandActive} trackColor={{ true: '#f97316' }} />
        </View>
        {onDemandActive && (
          <View style={styles.activeStatus}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Coverage Active - ₦100/trip</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>156</Text>
          <Text style={styles.statLabel}>Trips Protected</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₦18,500</Text>
          <Text style={styles.statLabel}>Premium Paid</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>45%</Text>
          <Text style={styles.statLabel}>Savings</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Insurance Products</Text>
      {products.map((product) => (
        <TouchableOpacity key={product.id} style={styles.productCard}>
          <View style={styles.productIcon}>
            <Icon name={product.icon} size={24} color="#f97316" />
          </View>
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <Text style={styles.productName}>{product.name}</Text>
              {product.popular && <View style={styles.popularBadge}><Text style={styles.popularText}>Popular</Text></View>}
            </View>
            <Text style={styles.productPrice}>{product.price}</Text>
          </View>
          <Icon name="chevron-right" size={24} color="#9ca3af" />
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.startButton}>
        <Icon name="play" size={20} color="#fff" />
        <Text style={styles.startButtonText}>Start Coverage</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  toggleCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 16, fontWeight: '500', color: '#111827' },
  activeStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, backgroundColor: '#dcfce7', borderRadius: 8 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 8 },
  activeText: { fontSize: 14, color: '#166534', fontWeight: '500' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, marginHorizontal: 4, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#f97316' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  productIcon: { width: 48, height: 48, backgroundColor: '#fff7ed', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, marginLeft: 12 },
  productHeader: { flexDirection: 'row', alignItems: 'center' },
  productName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  popularBadge: { backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  popularText: { fontSize: 10, color: '#f97316' },
  productPrice: { fontSize: 14, color: '#f97316', marginTop: 4 },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f97316', margin: 16, padding: 16, borderRadius: 12 },
  startButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
});
