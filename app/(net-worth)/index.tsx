import { ScrollView, Text, View, TouchableOpacity, TextInput, Modal, Platform, Dimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { LineChart } from "react-native-chart-kit";
import {
  Asset,
  Liability,
  NetWorthSnapshot,
  loadAssets,
  loadLiabilities,
  loadHistory,
  saveAsset,
  saveLiability,
  deleteAsset,
  deleteLiability,
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateNetWorth,
  calculateAssetAllocation,
  calculateDebtToAssetRatio,
  calculateGrowthRate,
  projectNetWorth,
  getAssetTypeIcon,
  getAssetTypeLabel,
  getLiabilityTypeIcon,
  getLiabilityTypeLabel,
} from "@/utils/net-worth";

export default function NetWorthDashboardScreen() {
  const colors = useColors();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [history, setHistory] = useState<NetWorthSnapshot[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [netWorth, setNetWorth] = useState(0);
  const [assetAllocation, setAssetAllocation] = useState<Record<string, number>>({});
  const [debtToAssetRatio, setDebtToAssetRatio] = useState(0);
  const [growthRate, setGrowthRate] = useState(0);
  const [projectedNetWorth, setProjectedNetWorth] = useState(0);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showAddLiabilityModal, setShowAddLiabilityModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [assetForm, setAssetForm] = useState<Partial<Asset>>({
    type: "checking",
  });
  const [liabilityForm, setLiabilityForm] = useState<Partial<Liability>>({
    type: "credit_card",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const loadedAssets = await loadAssets();
      setAssets(loadedAssets);

      const loadedLiabilities = await loadLiabilities();
      setLiabilities(loadedLiabilities);

      const loadedHistory = await loadHistory();
      setHistory(loadedHistory);

      const assets = await calculateTotalAssets();
      setTotalAssets(assets);

      const liabs = await calculateTotalLiabilities();
      setTotalLiabilities(liabs);

      const nw = await calculateNetWorth();
      setNetWorth(nw);

      const allocation = await calculateAssetAllocation();
      setAssetAllocation(allocation);

      const ratio = await calculateDebtToAssetRatio();
      setDebtToAssetRatio(ratio);

      const growth = await calculateGrowthRate();
      setGrowthRate(growth);

      const projected = await projectNetWorth(12);
      setProjectedNetWorth(projected);
    } catch (error) {
      console.error("Failed to load net worth data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAsset() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const newAsset: Asset = {
        id: Date.now().toString(),
        name: assetForm.name || "",
        type: assetForm.type || "checking",
        value: assetForm.value || 0,
        date: Date.now(),
        notes: assetForm.notes,
      };

      await saveAsset(newAsset);
      await loadData();
      setShowAddAssetModal(false);
      resetAssetForm();
    } catch (error) {
      console.error("Failed to add asset:", error);
    }
  }

  async function handleAddLiability() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const newLiability: Liability = {
        id: Date.now().toString(),
        name: liabilityForm.name || "",
        type: liabilityForm.type || "credit_card",
        balance: liabilityForm.balance || 0,
        interestRate: liabilityForm.interestRate || 0,
        monthlyPayment: liabilityForm.monthlyPayment || 0,
        date: Date.now(),
        notes: liabilityForm.notes,
      };

      await saveLiability(newLiability);
      await loadData();
      setShowAddLiabilityModal(false);
      resetLiabilityForm();
    } catch (error) {
      console.error("Failed to add liability:", error);
    }
  }

  async function handleDeleteAsset(assetId: string) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await deleteAsset(assetId);
      await loadData();
    } catch (error) {
      console.error("Failed to delete asset:", error);
    }
  }

  async function handleDeleteLiability(liabilityId: string) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await deleteLiability(liabilityId);
      await loadData();
    } catch (error) {
      console.error("Failed to delete liability:", error);
    }
  }

  function resetAssetForm() {
    setAssetForm({ type: "checking" });
  }

  function resetLiabilityForm() {
    setLiabilityForm({ type: "credit_card" });
  }

  if (loading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-foreground">Loading net worth data...</Text>
      </ScreenContainer>
    );
  }

  // Prepare chart data
  const chartData = {
    labels: history.map((h) => {
      const date = new Date(h.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        data: history.map((h) => h.netWorth),
        color: (opacity = 1) => colors.primary,
        strokeWidth: 2,
      },
    ],
  };

  const screenWidth = Dimensions.get("window").width;

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Net Worth Dashboard</Text>
            <Text className="text-sm text-muted">Track your assets and liabilities</Text>
          </View>

          {/* Net Worth Card */}
          <View className="bg-primary rounded-2xl p-6">
            <Text className="text-sm text-white opacity-80 mb-2">Total Net Worth</Text>
            <Text className="text-4xl font-bold text-white mb-4">
              ${netWorth.toLocaleString()}
            </Text>
            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-xs text-white opacity-80 mb-1">Growth Rate</Text>
                <Text
                  className="text-lg font-semibold text-white"
                  style={{
                    color: growthRate >= 0 ? "#4ADE80" : "#F87171",
                  }}
                >
                  {growthRate >= 0 ? "+" : ""}
                  {growthRate.toFixed(1)}%
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-white opacity-80 mb-1">12-Month Projection</Text>
                <Text className="text-lg font-semibold text-white">
                  ${projectedNetWorth.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Summary Cards */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-xs text-muted mb-1">Assets</Text>
              <Text className="text-2xl font-bold text-success">
                ${totalAssets.toLocaleString()}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-xs text-muted mb-1">Liabilities</Text>
              <Text className="text-2xl font-bold text-error">
                ${totalLiabilities.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Debt-to-Asset Ratio */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-medium text-foreground">Debt-to-Asset Ratio</Text>
              <Text
                className="text-lg font-bold"
                style={{
                  color: debtToAssetRatio < 30 ? colors.success : debtToAssetRatio < 50 ? colors.warning : colors.error,
                }}
              >
                {debtToAssetRatio.toFixed(1)}%
              </Text>
            </View>
            <View className="h-2 bg-border rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(debtToAssetRatio, 100)}%`,
                  backgroundColor:
                    debtToAssetRatio < 30 ? colors.success : debtToAssetRatio < 50 ? colors.warning : colors.error,
                }}
              />
            </View>
            <Text className="text-xs text-muted mt-2">
              {debtToAssetRatio < 30 && "Excellent - Low debt relative to assets"}
              {debtToAssetRatio >= 30 && debtToAssetRatio < 50 && "Good - Moderate debt levels"}
              {debtToAssetRatio >= 50 && "High - Consider debt reduction strategies"}
            </Text>
          </View>

          {/* Net Worth History Chart */}
          {history.length > 0 && (
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-lg font-semibold text-foreground mb-4">
                Net Worth History
              </Text>
              <LineChart
                data={chartData}
                width={screenWidth - 80}
                height={220}
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => colors.primary,
                  labelColor: (opacity = 1) => colors.muted,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: "4",
                    strokeWidth: "2",
                    stroke: colors.primary,
                  },
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                yAxisLabel="$"
                yAxisSuffix=""
              />
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setShowAddAssetModal(true)}
              className="flex-1 bg-success rounded-xl p-4 items-center"
              style={{ opacity: 0.9 }}
            >
              <Text className="text-white font-semibold">Add Asset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowAddLiabilityModal(true)}
              className="flex-1 bg-error rounded-xl p-4 items-center"
              style={{ opacity: 0.9 }}
            >
              <Text className="text-white font-semibold">Add Liability</Text>
            </TouchableOpacity>
          </View>

          {/* Assets List */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Assets</Text>
            {assets.length === 0 ? (
              <View className="bg-surface rounded-2xl p-6 items-center border border-border">
                <Text className="text-muted text-center">No assets yet</Text>
              </View>
            ) : (
              assets.map((asset) => (
                <View
                  key={asset.id}
                  className="bg-surface rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-2xl">{getAssetTypeIcon(asset.type)}</Text>
                      <View>
                        <Text className="text-base font-semibold text-foreground">
                          {asset.name}
                        </Text>
                        <Text className="text-xs text-muted">{getAssetTypeLabel(asset.type)}</Text>
                      </View>
                    </View>
                    <Text className="text-lg font-bold text-success">
                      ${asset.value.toLocaleString()}
                    </Text>
                  </View>

                  {asset.notes && (
                    <Text className="text-sm text-muted mb-2">{asset.notes}</Text>
                  )}

                  <TouchableOpacity
                    onPress={() => handleDeleteAsset(asset.id)}
                    className="bg-error rounded-lg p-2 items-center mt-2"
                    style={{ opacity: 0.8 }}
                  >
                    <Text className="text-white text-xs font-medium">Delete</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Liabilities List */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Liabilities</Text>
            {liabilities.length === 0 ? (
              <View className="bg-surface rounded-2xl p-6 items-center border border-border">
                <Text className="text-muted text-center">No liabilities yet</Text>
              </View>
            ) : (
              liabilities.map((liability) => (
                <View
                  key={liability.id}
                  className="bg-surface rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-2xl">{getLiabilityTypeIcon(liability.type)}</Text>
                      <View>
                        <Text className="text-base font-semibold text-foreground">
                          {liability.name}
                        </Text>
                        <Text className="text-xs text-muted">
                          {getLiabilityTypeLabel(liability.type)}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-lg font-bold text-error">
                      ${liability.balance.toLocaleString()}
                    </Text>
                  </View>

                  <View className="gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted">Interest Rate</Text>
                      <Text className="text-sm font-medium text-foreground">
                        {liability.interestRate.toFixed(2)}%
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted">Monthly Payment</Text>
                      <Text className="text-sm font-medium text-foreground">
                        ${liability.monthlyPayment.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {liability.notes && (
                    <Text className="text-sm text-muted mt-2">{liability.notes}</Text>
                  )}

                  <TouchableOpacity
                    onPress={() => handleDeleteLiability(liability.id)}
                    className="bg-error rounded-lg p-2 items-center mt-2"
                    style={{ opacity: 0.8 }}
                  >
                    <Text className="text-white text-xs font-medium">Delete</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Asset Allocation */}
          {Object.keys(assetAllocation).length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Asset Allocation</Text>
              {Object.entries(assetAllocation)
                .sort(([, a], [, b]) => b - a)
                .map(([type, percentage]) => (
                  <View
                    key={type}
                    className="bg-surface rounded-2xl p-4 border border-border"
                  >
                    <View className="flex-row justify-between items-center mb-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-2xl">
                          {getAssetTypeIcon(type as Asset["type"])}
                        </Text>
                        <Text className="text-sm font-medium text-foreground">
                          {getAssetTypeLabel(type as Asset["type"])}
                        </Text>
                      </View>
                      <Text className="text-base font-bold text-foreground">
                        {percentage.toFixed(1)}%
                      </Text>
                    </View>
                    <View className="h-2 bg-border rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: colors.primary,
                        }}
                      />
                    </View>
                  </View>
                ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Asset Modal */}
      <Modal visible={showAddAssetModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Add Asset</Text>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Name</Text>
                  <TextInput
                    value={assetForm.name}
                    onChangeText={(text) => setAssetForm({ ...assetForm, name: text })}
                    placeholder="Checking Account, Property, etc."
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Type</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["checking", "savings", "investment", "property"] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setAssetForm({ ...assetForm, type })}
                        className="px-4 py-2 rounded-full border"
                        style={{
                          backgroundColor:
                            assetForm.type === type ? colors.primary : colors.surface,
                          borderColor: assetForm.type === type ? colors.primary : colors.border,
                        }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: assetForm.type === type ? "#FFFFFF" : colors.foreground,
                          }}
                        >
                          {getAssetTypeLabel(type)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Value ($)</Text>
                  <TextInput
                    value={assetForm.value?.toString()}
                    onChangeText={(text) =>
                      setAssetForm({ ...assetForm, value: parseFloat(text) || 0 })
                    }
                    placeholder="10000"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddAssetModal(false);
                      resetAssetForm();
                    }}
                    className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                    style={{ opacity: 1 }}
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddAsset}
                    className="flex-1 bg-success rounded-xl p-4 items-center"
                    style={{ opacity: 1 }}
                  >
                    <Text className="text-white font-semibold">Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Liability Modal */}
      <Modal visible={showAddLiabilityModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Add Liability</Text>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Name</Text>
                  <TextInput
                    value={liabilityForm.name}
                    onChangeText={(text) => setLiabilityForm({ ...liabilityForm, name: text })}
                    placeholder="Mortgage, Credit Card, etc."
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Type</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["mortgage", "auto_loan", "credit_card", "personal_loan"] as const).map(
                      (type) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => setLiabilityForm({ ...liabilityForm, type })}
                          className="px-4 py-2 rounded-full border"
                          style={{
                            backgroundColor:
                              liabilityForm.type === type ? colors.primary : colors.surface,
                            borderColor:
                              liabilityForm.type === type ? colors.primary : colors.border,
                          }}
                        >
                          <Text
                            className="text-sm font-medium"
                            style={{
                              color: liabilityForm.type === type ? "#FFFFFF" : colors.foreground,
                            }}
                          >
                            {getLiabilityTypeLabel(type)}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Balance ($)</Text>
                  <TextInput
                    value={liabilityForm.balance?.toString()}
                    onChangeText={(text) =>
                      setLiabilityForm({ ...liabilityForm, balance: parseFloat(text) || 0 })
                    }
                    placeholder="5000"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Interest Rate (%)</Text>
                  <TextInput
                    value={liabilityForm.interestRate?.toString()}
                    onChangeText={(text) =>
                      setLiabilityForm({ ...liabilityForm, interestRate: parseFloat(text) || 0 })
                    }
                    placeholder="4.5"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Monthly Payment ($)</Text>
                  <TextInput
                    value={liabilityForm.monthlyPayment?.toString()}
                    onChangeText={(text) =>
                      setLiabilityForm({
                        ...liabilityForm,
                        monthlyPayment: parseFloat(text) || 0,
                      })
                    }
                    placeholder="150"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddLiabilityModal(false);
                      resetLiabilityForm();
                    }}
                    className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                    style={{ opacity: 1 }}
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddLiability}
                    className="flex-1 bg-error rounded-xl p-4 items-center"
                    style={{ opacity: 1 }}
                  >
                    <Text className="text-white font-semibold">Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
