import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TAX_DATA_KEY = 'taxData';

const taxBrackets2024 = [
  { min: 0, max: 11000, rate: 0.10 },
  { min: 11001, max: 44725, rate: 0.12 },
  { min: 44726, max: 95375, rate: 0.22 },
  { min: 95376, max: 182100, rate: 0.24 },
  { min: 182101, max: 231250, rate: 0.32 },
  { min: 231251, max: 578125, rate: 0.35 },
  { min: 578126, max: Infinity, rate: 0.37 },
];

export default function TaxPlanningScreen() {
  const router = useRouter();
  const [income, setIncome] = useState('');
  const [deductions, setDeductions] = useState('');
  const [estimatedTax, setEstimatedTax] = useState(0);
  const [effectiveRate, setEffectiveRate] = useState(0);
  const [taxBracket, setTaxBracket] = useState('');

  useEffect(() => {
    loadTaxData();
  }, []);

  useEffect(() => {
    calculateTax();
  }, [income, deductions]);

  const loadTaxData = async () => {
    try {
      const stored = await AsyncStorage.getItem(TAX_DATA_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setIncome(data.income || '');
        setDeductions(data.deductions || '');
      }
    } catch (error) {
      console.error('Failed to load tax data:', error);
    }
  };

  const saveTaxData = async () => {
    try {
      await AsyncStorage.setItem(
        TAX_DATA_KEY,
        JSON.stringify({ income, deductions })
      );
    } catch (error) {
      console.error('Failed to save tax data:', error);
    }
  };

  const calculateTax = () => {
    const grossIncome = parseFloat(income) || 0;
    const totalDeductions = parseFloat(deductions) || 0;
    const taxableIncome = Math.max(0, grossIncome - totalDeductions);

    let tax = 0;
    let previousMax = 0;

    for (const bracket of taxBrackets2024) {
      if (taxableIncome > bracket.min) {
        const taxableInBracket = Math.min(
          taxableIncome - bracket.min,
          bracket.max - bracket.min
        );
        tax += taxableInBracket * bracket.rate;
        previousMax = bracket.max;

        if (taxableIncome <= bracket.max) {
          setTaxBracket(`${(bracket.rate * 100).toFixed(0)}%`);
          break;
        }
      }
    }

    setEstimatedTax(tax);
    setEffectiveRate(grossIncome > 0 ? (tax / grossIncome) * 100 : 0);

    if (income && deductions) {
      saveTaxData();
    }
  };

  const quarterlyPayment = estimatedTax / 4;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Tax Planning', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-muted mb-6">
          Estimate your tax liability and plan quarterly payments for self-employment income.
        </Text>

        {/* Income Input */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Annual Gross Income</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground text-2xl mr-2">$</Text>
            <TextInput
              className="flex-1 text-foreground text-2xl"
              placeholder="0"
              placeholderTextColor="#9BA1A6"
              keyboardType="numeric"
              value={income}
              onChangeText={setIncome}
            />
          </View>
        </View>

        {/* Deductions Input */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Total Deductions</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground text-2xl mr-2">$</Text>
            <TextInput
              className="flex-1 text-foreground text-2xl"
              placeholder="0"
              placeholderTextColor="#9BA1A6"
              keyboardType="numeric"
              value={deductions}
              onChangeText={setDeductions}
            />
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tax)/deductions' as any)}
            className="mt-2"
            style={{ opacity: 1 }}
          >
            <Text className="text-primary font-semibold">Track Deductions →</Text>
          </TouchableOpacity>
        </View>

        {/* Tax Estimation Results */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Tax Estimation</Text>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-2">Estimated Tax Liability</Text>
            <Text className="text-primary font-bold text-5xl">
              ${estimatedTax.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>

          <View className="flex-row gap-4 mb-4">
            <View className="flex-1 bg-background rounded-xl p-4">
              <Text className="text-muted text-xs mb-1">Tax Bracket</Text>
              <Text className="text-foreground font-bold text-2xl">{taxBracket || '-'}</Text>
            </View>
            <View className="flex-1 bg-background rounded-xl p-4">
              <Text className="text-muted text-xs mb-1">Effective Rate</Text>
              <Text className="text-foreground font-bold text-2xl">
                {effectiveRate.toFixed(1)}%
              </Text>
            </View>
          </View>

          <View className="bg-primary/10 rounded-xl p-4 border border-primary/30">
            <Text className="text-muted text-sm mb-2">Quarterly Payment</Text>
            <Text className="text-primary font-bold text-3xl">
              ${quarterlyPayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
            <Text className="text-muted text-xs mt-2">
              Pay this amount every quarter to avoid penalties
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="gap-3 mb-6">
          <TouchableOpacity
            onPress={() => router.push('/(tax)/deductions' as any)}
            className="bg-primary rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-white text-center font-semibold text-lg">
              📊 Track Deductions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tax)/calendar' as any)}
            className="bg-surface border border-border rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground text-center font-semibold text-lg">
              📅 Tax Calendar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tax Brackets Reference */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">2024 Tax Brackets (Single)</Text>
          {taxBrackets2024.map((bracket, index) => (
            <View key={index} className="flex-row justify-between mb-3 last:mb-0">
              <Text className="text-muted text-sm">
                {bracket.min === 0 ? '$0' : `$${bracket.min.toLocaleString()}`} -{' '}
                {bracket.max === Infinity ? '+' : `$${bracket.max.toLocaleString()}`}
              </Text>
              <Text className="text-foreground font-semibold">
                {(bracket.rate * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>

        {/* Disclaimer */}
        <View className="bg-warning/10 rounded-xl p-4 mb-6 border border-warning/30">
          <Text className="text-muted text-xs text-center">
            ⚠️ This is an estimate for educational purposes. Consult a tax professional for
            accurate tax planning and filing.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
