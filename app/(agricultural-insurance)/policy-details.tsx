import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { router, useLocalSearchParams } from 'expo-router';

export default function PolicyDetailsScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const policyId = params.policyId as string;

  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<any>(null);

  useEffect(() => {
    loadPolicyDetails();
  }, [policyId]);

  const loadPolicyDetails = async () => {
    try {
      setLoading(true);
      // In production: GET from API
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock policy data
      const mockPolicy = {
        policy_id: policyId || 'POL-2024-001',
        farm_name: 'Green Valley Farm',
        crop_type: 'Maize',
        status: 'active',
        coverage_amount: 500000,
        premium_amount: 30000,
        start_date: '2024-01-15',
        end_date: '2024-07-15',
        coverage_period_months: 6,
        planted_area_hectares: 5.5,
        expected_yield_kg: 12000,
        planting_date: '2024-01-10',
        expected_harvest_date: '2024-06-30',
        risk_assessment: {
          risk_level: 'medium',
          risk_score: 45.5,
          weather_risk: 40.0,
          soil_risk: 30.0,
          pest_risk: 50.0,
          market_risk: 35.0,
          factors: [
            'Moderate rainfall expected',
            'Favorable soil conditions',
            'Medium pest risk for maize',
            'Stable market prices',
          ],
        },
        premium_breakdown: {
          base_premium: 25000,
          weather_adjustment: 2000,
          area_discount: 0,
          risk_multiplier: 1.0,
          total_premium: 30000,
          premium_rate_percent: 6.0,
        },
        claims: [
          {
            claim_id: 'CLM-001',
            loss_type: 'drought',
            loss_date: '2024-03-15',
            estimated_loss_percent: 25,
            status: 'approved',
            payout_amount: 125000,
          },
        ],
      };

      setPolicy(mockPolicy);
    } catch (error) {
      Alert.alert('Error', 'Failed to load policy details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = () => {
    router.push({
      pathname: '/(agricultural-insurance)/submit-claim',
      params: { policyId: policy.policy_id },
    });
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-success';
      case 'pending': return 'text-warning';
      case 'expired': return 'text-muted';
      case 'claimed': return 'text-primary';
      default: return 'text-muted';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/10';
      case 'pending': return 'bg-warning/10';
      case 'expired': return 'bg-muted/10';
      case 'claimed': return 'bg-primary/10';
      default: return 'bg-muted/10';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-error';
      default: return 'text-muted';
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-muted">Loading policy details...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!policy) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-bold text-foreground mb-2">Policy Not Found</Text>
          <Text className="text-muted text-center mb-6">
            The policy you're looking for doesn't exist or has been removed.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="rounded-2xl px-6 py-3 bg-primary"
          >
            <Text className="text-background font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 py-6 bg-surface border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-primary text-base">← Back</Text>
          </TouchableOpacity>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">{policy.farm_name}</Text>
              <Text className="mt-1 text-base text-muted">{policy.crop_type} Insurance</Text>
            </View>
            <View className={`rounded-full px-3 py-1 ${getStatusBgColor(policy.status)}`}>
              <Text className={`text-xs font-semibold capitalize ${getStatusColor(policy.status)}`}>
                {policy.status}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-4 py-6 gap-4">
          {/* Policy Overview */}
          <View className="rounded-2xl bg-surface p-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Policy Overview</Text>

            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Policy ID:</Text>
                <Text className="text-sm font-semibold text-foreground">{policy.policy_id}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Coverage Amount:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatCurrency(policy.coverage_amount)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Premium Paid:</Text>
                <Text className="text-sm font-semibold text-primary">
                  {formatCurrency(policy.premium_amount)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Coverage Period:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {policy.coverage_period_months} months
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Start Date:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatDate(policy.start_date)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">End Date:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatDate(policy.end_date)}
                </Text>
              </View>
            </View>
          </View>

          {/* Crop Details */}
          <View className="rounded-2xl bg-surface p-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Crop Details</Text>

            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Crop Type:</Text>
                <Text className="text-sm font-semibold text-foreground">{policy.crop_type}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Planted Area:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {policy.planted_area_hectares} hectares
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Expected Yield:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {policy.expected_yield_kg.toLocaleString()} kg
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Planting Date:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatDate(policy.planting_date)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Expected Harvest:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatDate(policy.expected_harvest_date)}
                </Text>
              </View>
            </View>
          </View>

          {/* Risk Assessment */}
          <View className="rounded-2xl bg-surface p-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Risk Assessment</Text>

            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Overall Risk Level:</Text>
                <Text className={`text-sm font-bold capitalize ${getRiskColor(policy.risk_assessment.risk_level)}`}>
                  {policy.risk_assessment.risk_level}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Risk Score:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {policy.risk_assessment.risk_score}/100
                </Text>
              </View>

              <View className="mt-3 pt-3 border-t border-border gap-2">
                <Text className="text-xs font-semibold text-foreground mb-1">Risk Breakdown:</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted">Weather Risk:</Text>
                  <Text className="text-xs text-foreground">{policy.risk_assessment.weather_risk}%</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted">Soil Risk:</Text>
                  <Text className="text-xs text-foreground">{policy.risk_assessment.soil_risk}%</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted">Pest Risk:</Text>
                  <Text className="text-xs text-foreground">{policy.risk_assessment.pest_risk}%</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted">Market Risk:</Text>
                  <Text className="text-xs text-foreground">{policy.risk_assessment.market_risk}%</Text>
                </View>
              </View>

              <View className="mt-3 pt-3 border-t border-border">
                <Text className="text-xs font-semibold text-foreground mb-2">Risk Factors:</Text>
                {policy.risk_assessment.factors.map((factor: string, index: number) => (
                  <Text key={index} className="text-xs text-muted mb-1">• {factor}</Text>
                ))}
              </View>
            </View>
          </View>

          {/* Premium Breakdown */}
          <View className="rounded-2xl bg-primary/10 p-4 border border-primary">
            <Text className="text-lg font-bold text-foreground mb-4">Premium Breakdown</Text>

            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Base Premium:</Text>
                <Text className="text-sm text-foreground">
                  {formatCurrency(policy.premium_breakdown.base_premium)}
                </Text>
              </View>
              {policy.premium_breakdown.weather_adjustment > 0 && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Weather Adjustment:</Text>
                  <Text className="text-sm text-foreground">
                    +{formatCurrency(policy.premium_breakdown.weather_adjustment)}
                  </Text>
                </View>
              )}
              {policy.premium_breakdown.area_discount < 0 && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-success">Large Farm Discount:</Text>
                  <Text className="text-sm text-success">
                    {formatCurrency(policy.premium_breakdown.area_discount)}
                  </Text>
                </View>
              )}
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Risk Multiplier:</Text>
                <Text className="text-sm text-foreground">
                  {policy.premium_breakdown.risk_multiplier}x
                </Text>
              </View>
              <View className="mt-2 pt-3 border-t border-border flex-row items-center justify-between">
                <Text className="text-base font-bold text-foreground">Total Premium:</Text>
                <Text className="text-xl font-bold text-primary">
                  {formatCurrency(policy.premium_breakdown.total_premium)}
                </Text>
              </View>
              <Text className="text-xs text-muted text-right">
                ({policy.premium_breakdown.premium_rate_percent}% of coverage)
              </Text>
            </View>
          </View>

          {/* Claims History */}
          {policy.claims && policy.claims.length > 0 && (
            <View className="rounded-2xl bg-surface p-4 border border-border">
              <Text className="text-lg font-bold text-foreground mb-4">Claims History</Text>

              {policy.claims.map((claim: any) => (
                <View
                  key={claim.claim_id}
                  className="rounded-xl bg-background p-3 border border-border mb-3"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-semibold text-foreground">{claim.claim_id}</Text>
                    <View className={`rounded-full px-2 py-1 ${getStatusBgColor(claim.status)}`}>
                      <Text className={`text-xs font-semibold capitalize ${getStatusColor(claim.status)}`}>
                        {claim.status}
                      </Text>
                    </View>
                  </View>
                  <View className="gap-1">
                    <Text className="text-xs text-muted">
                      Loss Type: <Text className="text-foreground capitalize">{claim.loss_type}</Text>
                    </Text>
                    <Text className="text-xs text-muted">
                      Loss Date: <Text className="text-foreground">{formatDate(claim.loss_date)}</Text>
                    </Text>
                    <Text className="text-xs text-muted">
                      Estimated Loss: <Text className="text-foreground">{claim.estimated_loss_percent}%</Text>
                    </Text>
                    {claim.payout_amount && (
                      <Text className="text-xs text-muted">
                        Payout: <Text className="text-success font-semibold">{formatCurrency(claim.payout_amount)}</Text>
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Submit Claim Button */}
          {policy.status === 'active' && (
            <TouchableOpacity
              onPress={handleSubmitClaim}
              className="rounded-2xl py-4 bg-primary items-center"
            >
              <Text className="text-base font-semibold text-background">Submit Claim</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
