import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function SMEBusinessScreen() {
  const products = [
    { id: '1', name: 'Professional Liability', description: 'Errors & omissions coverage', premium: 'From ₦75,000/yr', icon: 'briefcase-account', coverage: '₦10M' },
    { id: '2', name: 'Cyber Insurance', description: 'Data breach & cyber attack protection', premium: 'From ₦50,000/yr', icon: 'shield-lock', coverage: '₦5M' },
    { id: '3', name: 'Business Interruption', description: 'Revenue loss protection', premium: 'From ₦100,000/yr', icon: 'store-alert', coverage: '₦20M' },
    { id: '4', name: 'Commercial Property', description: 'Building & equipment coverage', premium: 'From ₦85,000/yr', icon: 'office-building', coverage: '₦50M' },
    { id: '5', name: 'Directors & Officers', description: 'D&O liability protection', premium: 'From ₦120,000/yr', icon: 'account-tie', coverage: '₦25M' },
    { id: '6', name: 'Employee Benefits', description: 'Group health & life insurance', premium: 'From ₦15,000/employee', icon: 'account-group', coverage: 'Varies' },
  ];

  const riskScore = 72;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="domain" size={32} color="#6366f1" />
        <Text style={styles.title}>SME Business Insurance</Text>
        <Text style={styles.subtitle}>Protect your business</Text>
      </View>

      <View style={styles.riskCard}>
        <View style={styles.riskHeader}>
          <Text style={styles.riskTitle}>Business Risk Score</Text>
          <View style={styles.riskScoreBadge}>
            <Text style={styles.riskScoreText}>{riskScore}/100</Text>
          </View>
        </View>
        <View style={styles.riskBar}>
          <View style={[styles.riskFill, { width: `${riskScore}%` }]} />
        </View>
        <Text style={styles.riskDescription}>Good - Your business has moderate risk exposure</Text>
        <View style={styles.riskGaps}>
          <View style={styles.riskGap}>
            <Icon name="alert-circle" size={16} color="#f59e0b" />
            <Text style={styles.riskGapText}>No cyber insurance</Text>
          </View>
          <View style={styles.riskGap}>
            <Icon name="alert-circle" size={16} color="#f59e0b" />
            <Text style={styles.riskGapText}>D&O coverage recommended</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Business Insurance Products</Text>
      {products.map((product) => (
        <TouchableOpacity key={product.id} style={styles.productCard}>
          <View style={styles.productIcon}>
            <Icon name={product.icon} size={24} color="#6366f1" />
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productDescription}>{product.description}</Text>
            <View style={styles.productDetails}>
              <Text style={styles.productPremium}>{product.premium}</Text>
              <Text style={styles.productCoverage}>Up to {product.coverage}</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={24} color="#9ca3af" />
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.quoteButton}>
        <Icon name="calculator" size={20} color="#fff" />
        <Text style={styles.quoteButtonText}>Get Business Quote</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  riskCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  riskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  riskTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  riskScoreBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
  riskScoreText: { fontSize: 14, fontWeight: 'bold', color: '#166534' },
  riskBar: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  riskFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 4 },
  riskDescription: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  riskGaps: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  riskGap: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  riskGapText: { fontSize: 14, color: '#d97706', marginLeft: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  productIcon: { width: 48, height: 48, backgroundColor: '#eef2ff', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  productDescription: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  productDetails: { flexDirection: 'row', marginTop: 4 },
  productPremium: { fontSize: 12, color: '#6366f1', marginRight: 12 },
  productCoverage: { fontSize: 12, color: '#22c55e' },
  quoteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', margin: 16, padding: 16, borderRadius: 12 },
  quoteButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
});
