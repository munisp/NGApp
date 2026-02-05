import { ScrollView, Text, View, TouchableOpacity, TextInput, Modal, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import {
  InsurancePolicy,
  InsuranceClaim,
  loadPolicies,
  savePolicy,
  deletePolicy,
  loadClaims,
  saveClaim,
  getClaimsByPolicyId,
  updatePolicyStatus,
  calculateAnnualPremium,
  calculateTotalCoverage,
  calculateTotalAnnualPremiums,
  getPolicyTypeIcon,
  getPolicyTypeLabel,
  getStatusColor,
  getClaimStatusColor,
  compareCoverage,
  CoverageComparison,
} from "@/utils/insurance-tracker";

export default function InsuranceTrackerScreen() {
  const colors = useColors();
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareType, setCompareType] = useState<InsurancePolicy["type"]>("health");
  const [comparisons, setComparisons] = useState<CoverageComparison[]>([]);
  const [totalCoverage, setTotalCoverage] = useState(0);
  const [totalPremiums, setTotalPremiums] = useState(0);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState<Partial<InsurancePolicy>>({
    type: "health",
    premiumFrequency: "monthly",
    status: "active",
  });

  // Claim form state
  const [claimData, setClaimData] = useState<Partial<InsuranceClaim>>({
    status: "pending",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const loadedPolicies = await loadPolicies();
      const updatedPolicies = loadedPolicies.map(updatePolicyStatus);
      setPolicies(updatedPolicies);

      const loadedClaims = await loadClaims();
      setClaims(loadedClaims);

      const coverage = await calculateTotalCoverage();
      setTotalCoverage(coverage);

      const premiums = await calculateTotalAnnualPremiums();
      setTotalPremiums(premiums);
    } catch (error) {
      console.error("Failed to load insurance data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPolicy() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const newPolicy: InsurancePolicy = {
        id: Date.now().toString(),
        type: formData.type || "health",
        provider: formData.provider || "",
        policyNumber: formData.policyNumber || "",
        coverageAmount: formData.coverageAmount || 0,
        premium: formData.premium || 0,
        premiumFrequency: formData.premiumFrequency || "monthly",
        startDate: formData.startDate || Date.now(),
        renewalDate: formData.renewalDate || Date.now() + 365 * 24 * 60 * 60 * 1000,
        status: "active",
        beneficiaries: formData.beneficiaries,
        notes: formData.notes,
      };

      await savePolicy(newPolicy);
      await loadData();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error("Failed to add policy:", error);
    }
  }

  async function handleDeletePolicy(policyId: string) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await deletePolicy(policyId);
      await loadData();
      setSelectedPolicy(null);
    } catch (error) {
      console.error("Failed to delete policy:", error);
    }
  }

  async function handleAddClaim() {
    try {
      if (!selectedPolicy) return;

      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const newClaim: InsuranceClaim = {
        id: Date.now().toString(),
        policyId: selectedPolicy.id,
        claimNumber: claimData.claimNumber || `CLM-${Date.now()}`,
        claimDate: claimData.claimDate || Date.now(),
        claimAmount: claimData.claimAmount || 0,
        status: claimData.status || "pending",
        description: claimData.description || "",
        documents: claimData.documents,
      };

      await saveClaim(newClaim);
      const policyClaims = await getClaimsByPolicyId(selectedPolicy.id);
      setClaims(policyClaims);
      setShowClaimModal(false);
      resetClaimForm();
    } catch (error) {
      console.error("Failed to add claim:", error);
    }
  }

  async function handleCompare(type: InsurancePolicy["type"]) {
    try {
      setCompareType(type);
      const results = await compareCoverage(type);
      setComparisons(results);
      setShowCompareModal(true);
    } catch (error) {
      console.error("Failed to compare coverage:", error);
    }
  }

  function resetForm() {
    setFormData({
      type: "health",
      premiumFrequency: "monthly",
      status: "active",
    });
  }

  function resetClaimForm() {
    setClaimData({
      status: "pending",
    });
  }

  async function handlePolicyPress(policy: InsurancePolicy) {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedPolicy(policy);
    const policyClaims = await getClaimsByPolicyId(policy.id);
    setClaims(policyClaims);
  }

  if (loading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-foreground">Loading insurance data...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Insurance Tracker</Text>
            <Text className="text-sm text-muted">Manage your insurance policies and claims</Text>
          </View>

          {/* Summary Cards */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-xs text-muted mb-1">Total Coverage</Text>
              <Text className="text-2xl font-bold text-foreground">
                ${totalCoverage.toLocaleString()}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-xs text-muted mb-1">Annual Premiums</Text>
              <Text className="text-2xl font-bold text-foreground">
                ${totalPremiums.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              className="flex-1 bg-primary rounded-xl p-4 items-center"
              style={{ opacity: 1 }}
            >
              <Text className="text-white font-semibold">Add Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleCompare("health")}
              className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground font-semibold">Compare</Text>
            </TouchableOpacity>
          </View>

          {/* Policies List */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Your Policies</Text>
            {policies.length === 0 ? (
              <View className="bg-surface rounded-2xl p-6 items-center border border-border">
                <Text className="text-muted text-center">No insurance policies yet</Text>
                <Text className="text-muted text-center mt-1">Tap "Add Policy" to get started</Text>
              </View>
            ) : (
              policies.map((policy) => {
                const annualPremium = calculateAnnualPremium(policy);
                const daysUntilRenewal = Math.ceil(
                  (policy.renewalDate - Date.now()) / (24 * 60 * 60 * 1000)
                );

                return (
                  <TouchableOpacity
                    key={policy.id}
                    onPress={() => handlePolicyPress(policy)}
                    className="bg-surface rounded-2xl p-4 border border-border"
                    style={{ opacity: 1 }}
                  >
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-2xl">{getPolicyTypeIcon(policy.type)}</Text>
                        <View>
                          <Text className="text-base font-semibold text-foreground">
                            {getPolicyTypeLabel(policy.type)}
                          </Text>
                          <Text className="text-xs text-muted">{policy.provider}</Text>
                        </View>
                      </View>
                      <View
                        className="px-2 py-1 rounded-full"
                        style={{ backgroundColor: getStatusColor(policy.status, colors) + "20" }}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{ color: getStatusColor(policy.status, colors) }}
                        >
                          {policy.status.replace("_", " ").toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View className="gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Coverage</Text>
                        <Text className="text-sm font-medium text-foreground">
                          ${policy.coverageAmount.toLocaleString()}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Premium</Text>
                        <Text className="text-sm font-medium text-foreground">
                          ${policy.premium}/{policy.premiumFrequency.slice(0, 1)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Annual Cost</Text>
                        <Text className="text-sm font-medium text-foreground">
                          ${annualPremium.toLocaleString()}/year
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Renewal</Text>
                        <Text className="text-sm font-medium text-foreground">
                          {daysUntilRenewal > 0 ? `${daysUntilRenewal} days` : "Expired"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Selected Policy Details */}
          {selectedPolicy && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Policy Details</Text>
              <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Policy Number</Text>
                  <Text className="text-sm text-muted">{selectedPolicy.policyNumber}</Text>
                </View>

                {selectedPolicy.beneficiaries && selectedPolicy.beneficiaries.length > 0 && (
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Beneficiaries</Text>
                    <Text className="text-sm text-muted">
                      {selectedPolicy.beneficiaries.join(", ")}
                    </Text>
                  </View>
                )}

                {selectedPolicy.notes && (
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Notes</Text>
                    <Text className="text-sm text-muted">{selectedPolicy.notes}</Text>
                  </View>
                )}

                <View className="flex-row gap-3 mt-2">
                  <TouchableOpacity
                    onPress={() => setShowClaimModal(true)}
                    className="flex-1 bg-primary rounded-xl p-3 items-center"
                    style={{ opacity: 1 }}
                  >
                    <Text className="text-white font-medium">File Claim</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeletePolicy(selectedPolicy.id)}
                    className="flex-1 bg-error rounded-xl p-3 items-center"
                    style={{ opacity: 1 }}
                  >
                    <Text className="text-white font-medium">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Claims for Selected Policy */}
              {claims.length > 0 && (
                <View className="gap-3">
                  <Text className="text-base font-semibold text-foreground">Claims History</Text>
                  {claims.map((claim) => (
                    <View
                      key={claim.id}
                      className="bg-surface rounded-2xl p-4 border border-border gap-2"
                    >
                      <View className="flex-row justify-between items-start">
                        <View>
                          <Text className="text-sm font-medium text-foreground">
                            {claim.claimNumber}
                          </Text>
                          <Text className="text-xs text-muted">
                            {new Date(claim.claimDate).toLocaleDateString()}
                          </Text>
                        </View>
                        <View
                          className="px-2 py-1 rounded-full"
                          style={{
                            backgroundColor: getClaimStatusColor(claim.status, colors) + "20",
                          }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{ color: getClaimStatusColor(claim.status, colors) }}
                          >
                            {claim.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-sm text-muted">{claim.description}</Text>
                      <Text className="text-base font-semibold text-foreground">
                        ${claim.claimAmount.toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Policy Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Add Insurance Policy</Text>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Policy Type</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["health", "auto", "life", "home"] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setFormData({ ...formData, type })}
                        className="px-4 py-2 rounded-full border"
                        style={{
                          backgroundColor:
                            formData.type === type ? colors.primary : colors.surface,
                          borderColor: formData.type === type ? colors.primary : colors.border,
                        }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: formData.type === type ? "#FFFFFF" : colors.foreground,
                          }}
                        >
                          {getPolicyTypeLabel(type)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Provider</Text>
                  <TextInput
                    value={formData.provider}
                    onChangeText={(text) => setFormData({ ...formData, provider: text })}
                    placeholder="Insurance Company Name"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Policy Number</Text>
                  <TextInput
                    value={formData.policyNumber}
                    onChangeText={(text) => setFormData({ ...formData, policyNumber: text })}
                    placeholder="POL-123456"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Coverage Amount ($)</Text>
                  <TextInput
                    value={formData.coverageAmount?.toString()}
                    onChangeText={(text) =>
                      setFormData({ ...formData, coverageAmount: parseFloat(text) || 0 })
                    }
                    placeholder="100000"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Premium ($)</Text>
                  <TextInput
                    value={formData.premium?.toString()}
                    onChangeText={(text) =>
                      setFormData({ ...formData, premium: parseFloat(text) || 0 })
                    }
                    placeholder="150"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Premium Frequency</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["monthly", "quarterly", "annual"] as const).map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        onPress={() => setFormData({ ...formData, premiumFrequency: freq })}
                        className="px-4 py-2 rounded-full border"
                        style={{
                          backgroundColor:
                            formData.premiumFrequency === freq ? colors.primary : colors.surface,
                          borderColor:
                            formData.premiumFrequency === freq ? colors.primary : colors.border,
                        }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color:
                              formData.premiumFrequency === freq ? "#FFFFFF" : colors.foreground,
                          }}
                        >
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                    style={{ opacity: 1 }}
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddPolicy}
                    className="flex-1 bg-primary rounded-xl p-4 items-center"
                    style={{ opacity: 1 }}
                  >
                    <Text className="text-white font-semibold">Add Policy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* File Claim Modal */}
      <Modal visible={showClaimModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "70%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">File Insurance Claim</Text>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Claim Amount ($)</Text>
                  <TextInput
                    value={claimData.claimAmount?.toString()}
                    onChangeText={(text) =>
                      setClaimData({ ...claimData, claimAmount: parseFloat(text) || 0 })
                    }
                    placeholder="5000"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Description</Text>
                  <TextInput
                    value={claimData.description}
                    onChangeText={(text) => setClaimData({ ...claimData, description: text })}
                    placeholder="Describe the claim..."
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={4}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                    style={{ textAlignVertical: "top" }}
                  />
                </View>

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => {
                      setShowClaimModal(false);
                      resetClaimForm();
                    }}
                    className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                    style={{ opacity: 1 }}
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddClaim}
                    className="flex-1 bg-primary rounded-xl p-4 items-center"
                    style={{ opacity: 1 }}
                  >
                    <Text className="text-white font-semibold">Submit Claim</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Coverage Comparison Modal */}
      <Modal visible={showCompareModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "70%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Coverage Comparison</Text>
                <Text className="text-sm text-muted">
                  Comparing {getPolicyTypeLabel(compareType)} policies
                </Text>

                {comparisons.length === 0 ? (
                  <View className="bg-surface rounded-2xl p-6 items-center border border-border">
                    <Text className="text-muted text-center">
                      No policies to compare for this type
                    </Text>
                  </View>
                ) : (
                  comparisons.map((comparison, index) => (
                    <View
                      key={index}
                      className="bg-surface rounded-2xl p-4 border border-border gap-2"
                    >
                      <Text className="text-base font-semibold text-foreground">
                        {comparison.provider}
                      </Text>
                      <View className="gap-1">
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Coverage</Text>
                          <Text className="text-sm font-medium text-foreground">
                            ${comparison.coverageAmount.toLocaleString()}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Annual Premium</Text>
                          <Text className="text-sm font-medium text-foreground">
                            ${comparison.annualPremium.toLocaleString()}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Cost per $1,000</Text>
                          <Text className="text-sm font-medium text-primary">
                            ${comparison.costPerThousand.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                      {index === 0 && (
                        <View className="bg-success rounded-lg p-2 mt-1" style={{ opacity: 0.2 }}>
                          <Text className="text-xs font-medium text-success text-center">
                            Best Value
                          </Text>
                        </View>
                      )}
                    </View>
                  ))
                )}

                <TouchableOpacity
                  onPress={() => setShowCompareModal(false)}
                  className="bg-primary rounded-xl p-4 items-center mt-2"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-white font-semibold">Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
