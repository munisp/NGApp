import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Slider from '@react-native-community/slider';

interface PremiumBreakdown {
  basePremium: number;
  riskAdjustment: number;
  discounts: { name: string; amount: number }[];
  taxes: number;
  totalPremium: number;
  monthlyPremium: number;
}

const PremiumCalculatorScreen: React.FC = () => {
  const [productType, setProductType] = useState('health');
  const [coverageAmount, setCoverageAmount] = useState(2000000);
  const [age, setAge] = useState(35);
  const [premium, setPremium] = useState<PremiumBreakdown | null>(null);

  useEffect(() => {
    calculatePremium();
  }, [productType, coverageAmount, age]);

  const calculatePremium = () => {
    let basePremium = 0;
    let riskAdjustment = 0;
    const discounts: { name: string; amount: number }[] = [];

    switch (productType) {
      case 'health':
        basePremium = coverageAmount * 0.035;
        riskAdjustment = age > 50 ? basePremium * 0.25 : age > 40 ? basePremium * 0.15 : 0;
        if (age < 30) discounts.push({ name: 'Young Adult Discount', amount: basePremium * 0.1 });
        break;
      case 'auto':
        basePremium = coverageAmount * 0.025;
        discounts.push({ name: 'No Claims Bonus', amount: basePremium * 0.15 });
        break;
      case 'life':
        basePremium = coverageAmount * 0.012;
        riskAdjustment = age > 50 ? basePremium * 0.4 : age > 40 ? basePremium * 0.2 : 0;
        if (age < 35) discounts.push({ name: 'Young Policyholder', amount: basePremium * 0.15 });
        break;
    }

    const subtotal = basePremium + riskAdjustment - discounts.reduce((sum, d) => sum + d.amount, 0);
    const taxes = subtotal * 0.05;
    const totalPremium = subtotal + taxes;

    setPremium({
      basePremium,
      riskAdjustment,
      discounts,
      taxes,
      totalPremium,
      monthlyPremium: totalPremium / 12,
    });
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  };

  const productTypes = [
    { id: 'health', label: 'Health', icon: '❤️' },
    { id: 'auto', label: 'Auto', icon: '🚗' },
    { id: 'life', label: 'Life', icon: '🛡️' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Premium Calculator</Text>
          <Text style={styles.subtitle}>Get instant premium estimates</Text>
        </View>

        {/* Product Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insurance Type</Text>
          <View style={styles.productTypes}>
            {productTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.productTypeButton,
                  productType === type.id && styles.productTypeButtonActive,
                ]}
                onPress={() => setProductType(type.id)}
              >
                <Text style={styles.productTypeIcon}>{type.icon}</Text>
                <Text
                  style={[
                    styles.productTypeLabel,
                    productType === type.id && styles.productTypeLabelActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Coverage Amount */}
        <View style={styles.section}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sectionTitle}>Coverage Amount</Text>
            <Text style={styles.sliderValue}>{formatCurrency(coverageAmount)}</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={1000000}
            maximumValue={10000000}
            step={500000}
            value={coverageAmount}
            onValueChange={setCoverageAmount}
            minimumTrackTintColor="#2563EB"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#2563EB"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>₦1M</Text>
            <Text style={styles.sliderLabel}>₦10M</Text>
          </View>
        </View>

        {/* Age */}
        <View style={styles.section}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sectionTitle}>Your Age</Text>
            <Text style={styles.sliderValue}>{age} years</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={18}
            maximumValue={70}
            step={1}
            value={age}
            onValueChange={setAge}
            minimumTrackTintColor="#2563EB"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#2563EB"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>18</Text>
            <Text style={styles.sliderLabel}>70</Text>
          </View>
        </View>

        {/* Premium Display */}
        {premium && (
          <View style={styles.premiumCard}>
            <Text style={styles.premiumLabel}>Estimated Annual Premium</Text>
            <Text style={styles.premiumAmount}>{formatCurrency(premium.totalPremium)}</Text>
            <Text style={styles.monthlyLabel}>
              {formatCurrency(premium.monthlyPremium)}/month
            </Text>

            <View style={styles.breakdown}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Base Premium</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(premium.basePremium)}</Text>
              </View>
              {premium.riskAdjustment !== 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Risk Adjustment</Text>
                  <Text style={[styles.breakdownValue, { color: premium.riskAdjustment > 0 ? '#EF4444' : '#10B981' }]}>
                    {premium.riskAdjustment > 0 ? '+' : ''}{formatCurrency(premium.riskAdjustment)}
                  </Text>
                </View>
              )}
              {premium.discounts.map((discount, i) => (
                <View key={i} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{discount.name}</Text>
                  <Text style={[styles.breakdownValue, { color: '#10B981' }]}>
                    -{formatCurrency(discount.amount)}
                  </Text>
                </View>
              ))}
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>VAT (5%)</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(premium.taxes)}</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.quoteButton}>
          <Text style={styles.quoteButtonText}>Get a Quote</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#2563EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#BFDBFE',
    marginTop: 4,
  },
  section: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  productTypes: {
    flexDirection: 'row',
    gap: 12,
  },
  productTypeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  productTypeButtonActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  productTypeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  productTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  productTypeLabelActive: {
    color: '#2563EB',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  premiumCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#2563EB',
    borderRadius: 16,
  },
  premiumLabel: {
    fontSize: 14,
    color: '#BFDBFE',
    textAlign: 'center',
  },
  premiumAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
  },
  monthlyLabel: {
    fontSize: 16,
    color: '#BFDBFE',
    textAlign: 'center',
    marginTop: 4,
  },
  breakdown: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#BFDBFE',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  quoteButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
  },
  quoteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PremiumCalculatorScreen;
