import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function SavingsInvestmentScreen() {
  const products = [
    { id: '1', name: 'Education Savings Plan', returns: '8-12%', minInvestment: 50000, term: '5-18 years', icon: 'school', popular: true },
    { id: '2', name: 'Retirement Annuity', returns: '10-15%', minInvestment: 100000, term: '10-30 years', icon: 'beach', popular: true },
    { id: '3', name: 'Endowment Policy', returns: '6-10%', minInvestment: 25000, term: '5-20 years', icon: 'gift', popular: false },
    { id: '4', name: 'Unit-Linked Insurance', returns: 'Market-linked', minInvestment: 100000, term: '5+ years', icon: 'chart-line', popular: false },
  ];

  const myInvestments = [
    { id: '1', name: 'Education Fund - David', value: 2500000, growth: 12.5, monthlyContribution: 50000 },
    { id: '2', name: 'Retirement Plan', value: 8900000, growth: 15.2, monthlyContribution: 100000 },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="piggy-bank" size={32} color="#22c55e" />
        <Text style={styles.title}>Savings & Investment</Text>
        <Text style={styles.subtitle}>Grow your wealth with insurance</Text>
      </View>

      <View style={styles.portfolioCard}>
        <Text style={styles.portfolioLabel}>Total Portfolio Value</Text>
        <Text style={styles.portfolioValue}>₦11,400,000</Text>
        <View style={styles.portfolioStats}>
          <View style={styles.portfolioStat}>
            <Icon name="trending-up" size={16} color="#22c55e" />
            <Text style={styles.portfolioGrowth}>+14.2% YTD</Text>
          </View>
          <View style={styles.portfolioStat}>
            <Icon name="calendar" size={16} color="#6b7280" />
            <Text style={styles.portfolioContribution}>₦150K/month</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>My Investments</Text>
      {myInvestments.map((investment) => (
        <TouchableOpacity key={investment.id} style={styles.investmentCard}>
          <View style={styles.investmentInfo}>
            <Text style={styles.investmentName}>{investment.name}</Text>
            <Text style={styles.investmentContribution}>₦{investment.monthlyContribution.toLocaleString()}/month</Text>
          </View>
          <View style={styles.investmentValue}>
            <Text style={styles.valueAmount}>₦{(investment.value / 1000000).toFixed(1)}M</Text>
            <View style={styles.growthBadge}>
              <Icon name="trending-up" size={12} color="#22c55e" />
              <Text style={styles.growthText}>+{investment.growth}%</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Investment Products</Text>
      {products.map((product) => (
        <TouchableOpacity key={product.id} style={styles.productCard}>
          <View style={styles.productIcon}>
            <Icon name={product.icon} size={24} color="#22c55e" />
          </View>
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <Text style={styles.productName}>{product.name}</Text>
              {product.popular && <View style={styles.popularBadge}><Text style={styles.popularText}>Popular</Text></View>}
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.productDetail}>Returns: {product.returns}</Text>
              <Text style={styles.productDetail}>Min: ₦{product.minInvestment.toLocaleString()}</Text>
            </View>
            <Text style={styles.productTerm}>Term: {product.term}</Text>
          </View>
          <Icon name="chevron-right" size={24} color="#9ca3af" />
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
  portfolioCard: { backgroundColor: '#22c55e', margin: 16, padding: 20, borderRadius: 16 },
  portfolioLabel: { fontSize: 14, color: '#bbf7d0' },
  portfolioValue: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  portfolioStats: { flexDirection: 'row', marginTop: 16 },
  portfolioStat: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  portfolioGrowth: { fontSize: 14, color: '#fff', marginLeft: 4 },
  portfolioContribution: { fontSize: 14, color: '#bbf7d0', marginLeft: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  investmentCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  investmentInfo: { flex: 1 },
  investmentName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  investmentContribution: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  investmentValue: { alignItems: 'flex-end' },
  valueAmount: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  growthBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  growthText: { fontSize: 12, color: '#166534', marginLeft: 2 },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  productIcon: { width: 48, height: 48, backgroundColor: '#dcfce7', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, marginLeft: 12 },
  productHeader: { flexDirection: 'row', alignItems: 'center' },
  productName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  popularBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  popularText: { fontSize: 10, color: '#166534' },
  productDetails: { flexDirection: 'row', marginTop: 4 },
  productDetail: { fontSize: 12, color: '#22c55e', marginRight: 12 },
  productTerm: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
