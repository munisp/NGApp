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
import { router } from 'expo-router';

interface Farm {
  id: string;
  farmName: string;
  location: string;
  size: number;
  soilType: string;
  irrigation: boolean;
}

interface Policy {
  id: string;
  policyNumber: string;
  farmName: string;
  cropType: string;
  coverageAmount: number;
  premium: number;
  status: string;
  startDate: string;
  endDate: string;
  riskLevel: string;
}

export default function AgriculturalInsuranceScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [activeTab, setActiveTab] = useState<'farms' | 'policies'>('farms');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // In production: fetch from API
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock data
      setFarms([
        {
          id: '1',
          farmName: 'Green Valley Farm',
          location: 'Ikeja, Lagos',
          size: 5.5,
          soilType: 'Loamy',
          irrigation: true,
        },
        {
          id: '2',
          farmName: 'Sunrise Farms',
          location: 'Gwagwalada, Abuja',
          size: 12.0,
          soilType: 'Sandy',
          irrigation: false,
        },
      ]);

      setPolicies([
        {
          id: '1',
          policyNumber: 'AGR202612AB34CD',
          farmName: 'Green Valley Farm',
          cropType: 'Maize',
          coverageAmount: 500000,
          premium: 25000,
          status: 'active',
          startDate: '2026-01-15',
          endDate: '2026-07-15',
          riskLevel: 'medium',
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG')}`;
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'low':
        return 'text-success';
      case 'medium':
        return 'text-warning';
      case 'high':
      case 'very_high':
        return 'text-error';
      default:
        return 'text-muted';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-success/10 text-success';
      case 'pending':
        return 'bg-warning/10 text-warning';
      case 'expired':
        return 'bg-error/10 text-error';
      default:
        return 'bg-surface text-muted';
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 py-6 bg-surface border-b border-border">
          <Text className="text-3xl font-bold text-foreground">Agricultural Insurance</Text>
          <Text className="mt-2 text-base text-muted">
            Protect your crops with ML-powered insurance
          </Text>
        </View>

        {/* Tabs */}
        <View className="flex-row px-4 py-3 bg-background border-b border-border">
          <TouchableOpacity
            onPress={() => setActiveTab('farms')}
            className={`flex-1 pb-2 border-b-2 ${
              activeTab === 'farms' ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text
              className={`text-center text-base font-semibold ${
                activeTab === 'farms' ? 'text-primary' : 'text-muted'
              }`}
            >
              My Farms ({farms.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('policies')}
            className={`flex-1 pb-2 border-b-2 ${
              activeTab === 'policies' ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text
              className={`text-center text-base font-semibold ${
                activeTab === 'policies' ? 'text-primary' : 'text-muted'
              }`}
            >
              Policies ({policies.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {activeTab === 'farms' ? (
            <View className="gap-4">
              {/* Register Farm Button */}
              <TouchableOpacity
                onPress={() => router.push('/(agricultural-insurance)/register-farm')}
                className="rounded-2xl py-4 bg-primary items-center"
              >
                <Text className="text-base font-semibold text-background">+ Register New Farm</Text>
              </TouchableOpacity>

              {/* Farms List */}
              {farms.length === 0 ? (
                <View className="rounded-2xl bg-surface p-8 border border-border items-center">
                  <Text className="text-base text-muted text-center">No farms registered yet</Text>
                  <Text className="mt-2 text-sm text-muted text-center">
                    Register your farm to get started
                  </Text>
                </View>
              ) : (
                farms.map((farm) => (
                  <TouchableOpacity
                    key={farm.id}
                    onPress={() => router.push({
                      pathname: '/(agricultural-insurance)/apply',
                      params: { farmId: farm.id }
                    })}
                    className="rounded-2xl bg-surface p-4 border border-border"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-lg font-semibold text-foreground">{farm.farmName}</Text>
                      <View className={`px-3 py-1 rounded-full ${
                        farm.irrigation ? 'bg-success/10' : 'bg-surface'
                      }`}>
                        <Text className={`text-xs font-semibold ${
                          farm.irrigation ? 'text-success' : 'text-muted'
                        }`}>
                          {farm.irrigation ? 'Irrigated' : 'Rain-fed'}
                        </Text>
                      </View>
                    </View>

                    <View className="gap-2">
                      <View className="flex-row items-center">
                        <Text className="text-sm text-muted w-24">Location:</Text>
                        <Text className="text-sm text-foreground">{farm.location}</Text>
                      </View>
                      <View className="flex-row items-center">
                        <Text className="text-sm text-muted w-24">Size:</Text>
                        <Text className="text-sm text-foreground">{farm.size} hectares</Text>
                      </View>
                      <View className="flex-row items-center">
                        <Text className="text-sm text-muted w-24">Soil Type:</Text>
                        <Text className="text-sm text-foreground">{farm.soilType}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push({
                        pathname: '/(agricultural-insurance)/apply',
                        params: { farmId: farm.id }
                      })}
                      className="mt-4 rounded-xl py-2 bg-primary/10 items-center"
                    >
                      <Text className="text-sm font-semibold text-primary">Apply for Insurance</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : (
            <View className="gap-4">
              {/* Policies List */}
              {policies.length === 0 ? (
                <View className="rounded-2xl bg-surface p-8 border border-border items-center">
                  <Text className="text-base text-muted text-center">No policies yet</Text>
                  <Text className="mt-2 text-sm text-muted text-center">
                    Register a farm and apply for insurance
                  </Text>
                </View>
              ) : (
                policies.map((policy) => (
                  <TouchableOpacity
                    key={policy.id}
                    onPress={() => router.push({
                      pathname: '/(agricultural-insurance)/policy-details',
                      params: { policyId: policy.id }
                    })}
                    className="rounded-2xl bg-surface p-4 border border-border"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-base font-semibold text-foreground">
                        {policy.policyNumber}
                      </Text>
                      <View className={`px-3 py-1 rounded-full ${getStatusColor(policy.status)}`}>
                        <Text className="text-xs font-semibold capitalize">{policy.status}</Text>
                      </View>
                    </View>

                    <View className="gap-2 mb-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Farm:</Text>
                        <Text className="text-sm font-semibold text-foreground">{policy.farmName}</Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Crop:</Text>
                        <Text className="text-sm font-semibold text-foreground capitalize">
                          {policy.cropType}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Coverage:</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {formatCurrency(policy.coverageAmount)}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Premium:</Text>
                        <Text className="text-sm font-semibold text-primary">
                          {formatCurrency(policy.premium)}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-muted">Risk Level:</Text>
                        <Text className={`text-sm font-semibold capitalize ${getRiskColor(policy.riskLevel)}`}>
                          {policy.riskLevel}
                        </Text>
                      </View>
                    </View>

                    <View className="pt-3 border-t border-border">
                      <Text className="text-xs text-muted">
                        Valid: {new Date(policy.startDate).toLocaleDateString()} - {new Date(policy.endDate).toLocaleDateString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
