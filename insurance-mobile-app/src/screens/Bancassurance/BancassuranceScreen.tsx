import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function BancassuranceScreen() {
  const bankPartners = [
    { id: '1', name: 'First Bank of Nigeria', code: 'FBN', discount: 25, products: ['Life', 'Home', 'Auto'] },
    { id: '2', name: 'GTBank', code: 'GTB', discount: 20, products: ['Health', 'Travel', 'Device'] },
    { id: '3', name: 'Access Bank', code: 'ACC', discount: 30, products: ['Business', 'Life', 'Education'] },
    { id: '4', name: 'Zenith Bank', code: 'ZEN', discount: 15, products: ['Mortgage', 'Auto', 'Investment'] },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="bank" size={32} color="#2563eb" />
        <Text style={styles.title}>Bancassurance</Text>
        <Text style={styles.subtitle}>Insurance through your bank</Text>
      </View>

      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsTitle}>Why Bancassurance?</Text>
        <View style={styles.benefitItem}>
          <Icon name="percent" size={20} color="#22c55e" />
          <Text style={styles.benefitText}>Up to 40% discount on premiums</Text>
        </View>
        <View style={styles.benefitItem}>
          <Icon name="credit-card-sync" size={20} color="#22c55e" />
          <Text style={styles.benefitText}>Automatic premium deduction</Text>
        </View>
        <View style={styles.benefitItem}>
          <Icon name="file-document-check" size={20} color="#22c55e" />
          <Text style={styles.benefitText}>Simplified application process</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Partner Banks</Text>
      {bankPartners.map((bank) => (
        <TouchableOpacity key={bank.id} style={styles.bankCard}>
          <View style={styles.bankLogo}>
            <Text style={styles.bankCode}>{bank.code}</Text>
          </View>
          <View style={styles.bankInfo}>
            <Text style={styles.bankName}>{bank.name}</Text>
            <View style={styles.productsRow}>
              {bank.products.map((product, i) => (
                <View key={i} style={styles.productBadge}>
                  <Text style={styles.productBadgeText}>{product}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{bank.discount}% off</Text>
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.linkButton}>
        <Icon name="link-variant" size={20} color="#fff" />
        <Text style={styles.linkButtonText}>Link Bank Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  benefitsCard: { backgroundColor: '#eff6ff', margin: 16, padding: 16, borderRadius: 12 },
  benefitsTitle: { fontSize: 16, fontWeight: '600', color: '#1e40af', marginBottom: 12 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  benefitText: { fontSize: 14, color: '#1e40af', marginLeft: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  bankCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  bankLogo: { width: 48, height: 48, backgroundColor: '#eff6ff', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  bankCode: { fontSize: 14, fontWeight: 'bold', color: '#2563eb' },
  bankInfo: { flex: 1, marginLeft: 12 },
  bankName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  productsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  productBadge: { backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 4, marginTop: 4 },
  productBadgeText: { fontSize: 10, color: '#6b7280' },
  discountBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  discountText: { fontSize: 12, color: '#166534', fontWeight: '500' },
  linkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', margin: 16, padding: 16, borderRadius: 12 },
  linkButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
});
