import { View, Text, ScrollView, TextInput, TouchableOpacity, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';

export default function WealthProjectionsScreen() {
  const [currentWealth, setCurrentWealth] = useState('125000');
  const [monthlyContribution, setMonthlyContribution] = useState('2000');
  const [years, setYears] = useState('10');
  const [returnRate, setReturnRate] = useState('7');

  const calculateProjection = (rate: number) => {
    const current = parseFloat(currentWealth) || 0;
    const monthly = parseFloat(monthlyContribution) || 0;
    const numYears = parseInt(years) || 10;
    const annualRate = rate / 100;
    const monthlyRate = annualRate / 12;
    const months = numYears * 12;

    // Future value of current wealth
    const fvCurrent = current * Math.pow(1 + annualRate, numYears);

    // Future value of monthly contributions
    const fvContributions =
      monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

    return fvCurrent + fvContributions;
  };

  const conservativeProjection = calculateProjection(4);
  const moderateProjection = calculateProjection(7);
  const aggressiveProjection = calculateProjection(10);

  const chartHeight = 200;
  const maxValue = aggressiveProjection;
  const screenWidth = Dimensions.get('window').width - 64;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Wealth Projections', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-muted mb-6">
          Estimate your future wealth based on different investment return scenarios.
        </Text>

        {/* Input Form */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Your Information</Text>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-2">Current Wealth</Text>
            <View className="flex-row items-center bg-background border border-border rounded-xl p-4">
              <Text className="text-foreground text-xl mr-2">$</Text>
              <TextInput
                className="flex-1 text-foreground text-xl"
                placeholder="0"
                placeholderTextColor="#9BA1A6"
                keyboardType="numeric"
                value={currentWealth}
                onChangeText={setCurrentWealth}
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-2">Monthly Contribution</Text>
            <View className="flex-row items-center bg-background border border-border rounded-xl p-4">
              <Text className="text-foreground text-xl mr-2">$</Text>
              <TextInput
                className="flex-1 text-foreground text-xl"
                placeholder="0"
                placeholderTextColor="#9BA1A6"
                keyboardType="numeric"
                value={monthlyContribution}
                onChangeText={setMonthlyContribution}
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-2">Time Horizon (Years)</Text>
            <TextInput
              className="bg-background border border-border rounded-xl p-4 text-foreground text-xl"
              placeholder="10"
              placeholderTextColor="#9BA1A6"
              keyboardType="numeric"
              value={years}
              onChangeText={setYears}
            />
          </View>
        </View>

        {/* Projections */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">
            Projected Wealth in {years || 10} Years
          </Text>

          {/* Conservative */}
          <View className="mb-5">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-foreground font-semibold">Conservative (4%)</Text>
              <Text className="text-foreground font-bold text-xl">
                ${conservativeProjection.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View className="h-3 bg-border/30 rounded-full overflow-hidden">
              <View
                className="h-full bg-success rounded-full"
                style={{ width: `${(conservativeProjection / maxValue) * 100}%` }}
              />
            </View>
          </View>

          {/* Moderate */}
          <View className="mb-5">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-foreground font-semibold">Moderate (7%)</Text>
              <Text className="text-primary font-bold text-xl">
                ${moderateProjection.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View className="h-3 bg-border/30 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${(moderateProjection / maxValue) * 100}%` }}
              />
            </View>
          </View>

          {/* Aggressive */}
          <View>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-foreground font-semibold">Aggressive (10%)</Text>
              <Text className="text-warning font-bold text-xl">
                ${aggressiveProjection.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View className="h-3 bg-border/30 rounded-full overflow-hidden">
              <View
                className="h-full bg-warning rounded-full"
                style={{ width: `${(aggressiveProjection / maxValue) * 100}%` }}
              />
            </View>
          </View>
        </View>

        {/* Growth Breakdown */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">
            Moderate Scenario Breakdown
          </Text>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Starting Wealth</Text>
            <Text className="text-foreground font-semibold">
              ${parseFloat(currentWealth || '0').toLocaleString()}
            </Text>
          </View>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Total Contributions</Text>
            <Text className="text-foreground font-semibold">
              $
              {(
                (parseFloat(monthlyContribution || '0') * 12 * parseInt(years || '10'))
              ).toLocaleString()}
            </Text>
          </View>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Investment Growth</Text>
            <Text className="text-success font-semibold">
              $
              {(
                moderateProjection -
                parseFloat(currentWealth || '0') -
                parseFloat(monthlyContribution || '0') * 12 * parseInt(years || '10')
              ).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>

          <View className="h-px bg-border my-3" />

          <View className="flex-row justify-between">
            <Text className="text-foreground font-bold">Total Projected Wealth</Text>
            <Text className="text-primary font-bold text-xl">
              ${moderateProjection.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>

        {/* Disclaimer */}
        <View className="bg-warning/10 rounded-xl p-4 mb-6 border border-warning/30">
          <Text className="text-muted text-xs text-center">
            ⚠️ These projections are estimates based on historical market returns. Actual results
            may vary significantly. Past performance does not guarantee future results.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
