import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { router, useLocalSearchParams } from 'expo-router';

const CROP_TYPES = [
  { value: 'maize', label: 'Maize', baseRate: 0.05 },
  { value: 'rice', label: 'Rice', baseRate: 0.06 },
  { value: 'cassava', label: 'Cassava', baseRate: 0.04 },
  { value: 'yams', label: 'Yams', baseRate: 0.045 },
  { value: 'sorghum', label: 'Sorghum', baseRate: 0.05 },
  { value: 'millet', label: 'Millet', baseRate: 0.05 },
  { value: 'beans', label: 'Beans', baseRate: 0.07 },
  { value: 'groundnuts', label: 'Groundnuts', baseRate: 0.065 },
  { value: 'cocoa', label: 'Cocoa', baseRate: 0.08 },
  { value: 'palm_oil', label: 'Palm Oil', baseRate: 0.07 },
];

const COVERAGE_PERIODS = [
  { months: 3, label: '3 months', interestRate: 0 },
  { months: 4, label: '4 months', interestRate: 0.05 },
  { months: 5, label: '5 months', interestRate: 0.05 },
  { months: 6, label: '6 months', interestRate: 0.05 },
  { months: 7, label: '7 months', interestRate: 0.08 },
  { months: 8, label: '8 months', interestRate: 0.08 },
  { months: 9, label: '9 months', interestRate: 0.08 },
  { months: 10, label: '10 months', interestRate: 0.12 },
  { months: 11, label: '11 months', interestRate: 0.12 },
  { months: 12, label: '12 months', interestRate: 0.12 },
];

export default function ApplyInsuranceScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const farmId = params.farmId as string;

  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Form data
  const [cropType, setCropType] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [plantedArea, setPlantedArea] = useState('');
  const [expectedYield, setExpectedYield] = useState('');
  const [coverageAmount, setCoverageAmount] = useState('');
  const [coveragePeriod, setCoveragePeriod] = useState(6);

  // Risk assessment & premium
  const [riskAssessment, setRiskAssessment] = useState<any>(null);
  const [premium, setPremium] = useState<any>(null);

  const [showCropDropdown, setShowCropDropdown] = useState(false);

  useEffect(() => {
    if (cropType && coverageAmount && plantedArea) {
      calculatePremium();
    }
  }, [cropType, coverageAmount, coveragePeriod, plantedArea]);

  const calculatePremium = async () => {
    try {
      setCalculating(true);

      // Simulate API call for risk assessment and premium calculation
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock risk assessment
      const mockRiskAssessment = {
        risk_level: 'medium',
        risk_score: 45.5,
        weather_risk: 40.0,
        soil_risk: 30.0,
        pest_risk: 50.0,
        market_risk: 35.0,
        factors: ['Moderate weather risk', 'Favorable soil conditions', 'Medium pest risk'],
      };

      // Mock premium calculation
      const amount = parseFloat(coverageAmount);
      const crop = CROP_TYPES.find(c => c.value === cropType);
      const basePremium = amount * (crop?.baseRate || 0.05);
      const riskMultiplier = mockRiskAssessment.risk_level === 'medium' ? 1.0 : 0.8;
      const periodFactor = coveragePeriod / 12;
      const totalPremium = basePremium * riskMultiplier * periodFactor;

      const mockPremium = {
        base_premium: basePremium * periodFactor,
        risk_adjustment: 0,
        weather_adjustment: basePremium * 0.08 * periodFactor,
        area_adjustment: parseFloat(plantedArea) > 10 ? -basePremium * 0.10 * periodFactor : 0,
        total_premium: Math.max(totalPremium, 5000),
        premium_rate_percent: ((totalPremium / amount) * 100).toFixed(2),
      };

      setRiskAssessment(mockRiskAssessment);
      setPremium(mockPremium);
    } catch (error) {
      console.error('Error calculating premium:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!cropType) {
      Alert.alert('Required', 'Please select crop type');
      return;
    }
    if (!plantingDate || !harvestDate) {
      Alert.alert('Required', 'Please enter planting and harvest dates');
      return;
    }
    if (!plantedArea || parseFloat(plantedArea) <= 0) {
      Alert.alert('Invalid', 'Please enter valid planted area');
      return;
    }
    if (!expectedYield || parseFloat(expectedYield) <= 0) {
      Alert.alert('Invalid', 'Please enter expected yield');
      return;
    }
    if (!coverageAmount || parseFloat(coverageAmount) < 10000 || parseFloat(coverageAmount) > 10000000) {
      Alert.alert('Invalid', 'Coverage amount must be between ₦10,000 and ₦10,000,000');
      return;
    }

    try {
      setLoading(true);

      // In production: POST to API
      const applicationData = {
        farm_id: farmId,
        crop_info: {
          crop_type: cropType,
          planting_date: plantingDate,
          expected_harvest_date: harvestDate,
          planted_area_hectares: parseFloat(plantedArea),
          expected_yield_kg: parseFloat(expectedYield),
        },
        coverage_amount: parseFloat(coverageAmount),
        coverage_period_months: coveragePeriod,
      };

      await new Promise(resolve => setTimeout(resolve, 1500));

      Alert.alert(
        'Success',
        'Policy application submitted! Your application is pending approval.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-error';
      default: return 'text-muted';
    }
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 py-6 bg-surface border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-primary text-base">← Back</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">Apply for Insurance</Text>
          <Text className="mt-2 text-base text-muted">Protect your crops with ML-powered insurance</Text>
        </View>

        <View className="px-4 py-6 gap-4">
          {/* Crop Information */}
          <View className="rounded-2xl bg-surface p-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Crop Information</Text>

            <View className="gap-4">
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Crop Type *</Text>
                <TouchableOpacity
                  onPress={() => setShowCropDropdown(!showCropDropdown)}
                  className="rounded-xl px-4 py-3 bg-background border border-border"
                >
                  <Text className={cropType ? 'text-foreground' : 'text-muted'}>
                    {CROP_TYPES.find(c => c.value === cropType)?.label || 'Select crop'}
                  </Text>
                </TouchableOpacity>
                {showCropDropdown && (
                  <ScrollView className="max-h-48 mt-2 rounded-xl bg-background border border-border">
                    {CROP_TYPES.map((crop) => (
                      <TouchableOpacity
                        key={crop.value}
                        onPress={() => {
                          setCropType(crop.value);
                          setShowCropDropdown(false);
                        }}
                        className="px-4 py-3 border-b border-border"
                      >
                        <Text className="text-foreground">{crop.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">Planting Date *</Text>
                  <TextInput
                    value={plantingDate}
                    onChangeText={setPlantingDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    className="rounded-xl px-4 py-3 bg-background border border-border text-foreground"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">Harvest Date *</Text>
                  <TextInput
                    value={harvestDate}
                    onChangeText={setHarvestDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    className="rounded-xl px-4 py-3 bg-background border border-border text-foreground"
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">Planted Area (ha) *</Text>
                  <TextInput
                    value={plantedArea}
                    onChangeText={setPlantedArea}
                    placeholder="e.g., 2.5"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    className="rounded-xl px-4 py-3 bg-background border border-border text-foreground"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">Expected Yield (kg) *</Text>
                  <TextInput
                    value={expectedYield}
                    onChangeText={setExpectedYield}
                    placeholder="e.g., 5000"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    className="rounded-xl px-4 py-3 bg-background border border-border text-foreground"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Coverage Details */}
          <View className="rounded-2xl bg-surface p-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Coverage Details</Text>

            <View className="gap-4">
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Coverage Amount *</Text>
                <TextInput
                  value={coverageAmount}
                  onChangeText={setCoverageAmount}
                  placeholder="₦10,000 - ₦10,000,000"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  className="rounded-xl px-4 py-3 bg-background border border-border text-foreground"
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Coverage Period</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                  {COVERAGE_PERIODS.map((period) => (
                    <TouchableOpacity
                      key={period.months}
                      onPress={() => setCoveragePeriod(period.months)}
                      className={`rounded-xl px-4 py-3 border ${
                        coveragePeriod === period.months
                          ? 'bg-primary border-primary'
                          : 'bg-background border-border'
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          coveragePeriod === period.months ? 'text-background' : 'text-foreground'
                        }`}
                      >
                        {period.label}
                      </Text>
                      {period.interestRate > 0 && (
                        <Text
                          className={`text-xs ${
                            coveragePeriod === period.months ? 'text-background' : 'text-muted'
                          }`}
                        >
                          +{period.interestRate * 100}%
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* Risk Assessment & Premium */}
          {calculating && (
            <View className="rounded-2xl bg-surface p-8 border border-border items-center">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-4 text-muted">Calculating premium...</Text>
            </View>
          )}

          {!calculating && riskAssessment && premium && (
            <>
              {/* Risk Assessment */}
              <View className="rounded-2xl bg-surface p-4 border border-border">
                <Text className="text-lg font-bold text-foreground mb-4">Risk Assessment</Text>

                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Overall Risk Level:</Text>
                    <Text className={`text-sm font-bold capitalize ${getRiskColor(riskAssessment.risk_level)}`}>
                      {riskAssessment.risk_level}
                    </Text>
                  </View>

                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted">Weather Risk:</Text>
                      <Text className="text-xs text-foreground">{riskAssessment.weather_risk}%</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted">Soil Risk:</Text>
                      <Text className="text-xs text-foreground">{riskAssessment.soil_risk}%</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted">Pest Risk:</Text>
                      <Text className="text-xs text-foreground">{riskAssessment.pest_risk}%</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted">Market Risk:</Text>
                      <Text className="text-xs text-foreground">{riskAssessment.market_risk}%</Text>
                    </View>
                  </View>

                  <View className="mt-2 pt-3 border-t border-border">
                    <Text className="text-xs text-muted mb-1">Risk Factors:</Text>
                    {riskAssessment.factors.map((factor: string, index: number) => (
                      <Text key={index} className="text-xs text-foreground">• {factor}</Text>
                    ))}
                  </View>
                </View>
              </View>

              {/* Premium Calculation */}
              <View className="rounded-2xl bg-primary/10 p-4 border border-primary">
                <Text className="text-lg font-bold text-foreground mb-4">Premium Calculation</Text>

                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Base Premium:</Text>
                    <Text className="text-sm text-foreground">{formatCurrency(premium.base_premium)}</Text>
                  </View>
                  {premium.weather_adjustment > 0 && (
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">Weather Adjustment:</Text>
                      <Text className="text-sm text-foreground">+{formatCurrency(premium.weather_adjustment)}</Text>
                    </View>
                  )}
                  {premium.area_adjustment < 0 && (
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-success">Large Farm Discount:</Text>
                      <Text className="text-sm text-success">{formatCurrency(premium.area_adjustment)}</Text>
                    </View>
                  )}
                  <View className="mt-2 pt-3 border-t border-border flex-row items-center justify-between">
                    <Text className="text-base font-bold text-foreground">Total Premium:</Text>
                    <Text className="text-xl font-bold text-primary">{formatCurrency(premium.total_premium)}</Text>
                  </View>
                  <Text className="text-xs text-muted text-right">
                    ({premium.premium_rate_percent}% of coverage)
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !riskAssessment || !premium}
            className={`rounded-2xl py-4 items-center ${
              loading || !riskAssessment || !premium ? 'bg-surface' : 'bg-primary'
            }`}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className={`text-base font-semibold ${
                !riskAssessment || !premium ? 'text-muted' : 'text-background'
              }`}>
                Submit Application
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
