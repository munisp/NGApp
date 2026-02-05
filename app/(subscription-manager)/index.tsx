import { ScrollView, Text, View, TouchableOpacity, TextInput, Modal, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import {
  Subscription,
  SubscriptionAlert,
  loadSubscriptions,
  saveSubscription,
  deleteSubscription,
  calculateMonthlyCost,
  calculateAnnualCost,
  calculateTotalMonthlySpending,
  calculateTotalAnnualSpending,
  getSpendingByCategory,
  detectUnusedSubscriptions,
  getUpcomingRenewals,
  generateAlerts,
  acknowledgeAlert,
  getCategoryIcon,
  getCategoryLabel,
  getStatusColor,
  findAlternatives,
  AlternativeService,
} from "@/utils/subscription-manager";

export default function SubscriptionManagerScreen() {
  const colors = useColors();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [alerts, setAlerts] = useState<SubscriptionAlert[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeService[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAlternativesModal, setShowAlternativesModal] = useState(false);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [totalAnnual, setTotalAnnual] = useState(0);
  const [categorySpending, setCategorySpending] = useState<Record<string, number>>({});
  const [unusedSubs, setUnusedSubs] = useState<Subscription[]>([]);
  const [upcomingRenewals, setUpcomingRenewals] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState<Partial<Subscription>>({
    category: "streaming",
    billingCycle: "monthly",
    status: "active",
    autoRenew: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const loadedSubs = await loadSubscriptions();
      setSubscriptions(loadedSubs);

      const monthly = await calculateTotalMonthlySpending();
      setTotalMonthly(monthly);

      const annual = await calculateTotalAnnualSpending();
      setTotalAnnual(annual);

      const spending = await getSpendingByCategory();
      setCategorySpending(spending);

      const unused = await detectUnusedSubscriptions();
      setUnusedSubs(unused);

      const upcoming = await getUpcomingRenewals();
      setUpcomingRenewals(upcoming);

      const generatedAlerts = await generateAlerts();
      setAlerts(generatedAlerts);
    } catch (error) {
      console.error("Failed to load subscription data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSubscription() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const newSubscription: Subscription = {
        id: Date.now().toString(),
        name: formData.name || "",
        category: formData.category || "streaming",
        cost: formData.cost || 0,
        billingCycle: formData.billingCycle || "monthly",
        nextBillingDate:
          formData.nextBillingDate || Date.now() + 30 * 24 * 60 * 60 * 1000,
        status: "active",
        autoRenew: formData.autoRenew !== false,
        lastUsed: Date.now(),
        notes: formData.notes,
      };

      await saveSubscription(newSubscription);
      await loadData();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error("Failed to add subscription:", error);
    }
  }

  async function handleDeleteSubscription(subscriptionId: string) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await deleteSubscription(subscriptionId);
      await loadData();
      setSelectedSubscription(null);
    } catch (error) {
      console.error("Failed to delete subscription:", error);
    }
  }

  async function handleCancelSubscription(subscription: Subscription) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      subscription.status = "cancelled";
      await saveSubscription(subscription);
      await loadData();
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
    }
  }

  async function handleFindAlternatives(subscription: Subscription) {
    try {
      const alts = await findAlternatives(subscription.id);
      setAlternatives(alts);
      setSelectedSubscription(subscription);
      setShowAlternativesModal(true);
    } catch (error) {
      console.error("Failed to find alternatives:", error);
    }
  }

  async function handleAcknowledgeAlert(alertId: string) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await acknowledgeAlert(alertId);
      await loadData();
    } catch (error) {
      console.error("Failed to acknowledge alert:", error);
    }
  }

  function resetForm() {
    setFormData({
      category: "streaming",
      billingCycle: "monthly",
      status: "active",
      autoRenew: true,
    });
  }

  async function handleSubscriptionPress(subscription: Subscription) {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedSubscription(subscription);
  }

  if (loading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-foreground">Loading subscriptions...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Subscription Manager</Text>
            <Text className="text-sm text-muted">Track and manage all your subscriptions</Text>
          </View>

          {/* Summary Cards */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-xs text-muted mb-1">Monthly</Text>
              <Text className="text-2xl font-bold text-foreground">
                ${totalMonthly.toFixed(2)}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-xs text-muted mb-1">Annual</Text>
              <Text className="text-2xl font-bold text-foreground">
                ${totalAnnual.toFixed(2)}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-xs text-muted mb-1">Active</Text>
              <Text className="text-2xl font-bold text-foreground">
                {subscriptions.filter((s) => s.status === "active").length}
              </Text>
            </View>
          </View>

          {/* Alerts */}
          {alerts.filter((a) => !a.acknowledged).length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Alerts</Text>
              {alerts
                .filter((a) => !a.acknowledged)
                .map((alert) => (
                  <TouchableOpacity
                    key={alert.id}
                    onPress={() => handleAcknowledgeAlert(alert.id)}
                    className="bg-warning rounded-2xl p-4 border border-warning"
                    style={{ opacity: 0.9 }}
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-foreground">
                          {alert.type === "renewal" && "⏰ Renewal Reminder"}
                          {alert.type === "unused" && "⚠️ Unused Subscription"}
                          {alert.type === "price_change" && "💰 Price Change"}
                          {alert.type === "cancellation" && "❌ Cancellation"}
                        </Text>
                        <Text className="text-sm text-foreground mt-1">{alert.message}</Text>
                      </View>
                      <Text className="text-xs text-muted ml-2">Tap to dismiss</Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            className="bg-primary rounded-xl p-4 items-center"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold">Add Subscription</Text>
          </TouchableOpacity>

          {/* Subscriptions List */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Your Subscriptions</Text>
            {subscriptions.length === 0 ? (
              <View className="bg-surface rounded-2xl p-6 items-center border border-border">
                <Text className="text-muted text-center">No subscriptions yet</Text>
                <Text className="text-muted text-center mt-1">
                  Tap "Add Subscription" to get started
                </Text>
              </View>
            ) : (
              subscriptions.map((subscription) => {
                const monthlyCost = calculateMonthlyCost(subscription);
                const annualCost = calculateAnnualCost(subscription);
                const daysUntilRenewal = Math.ceil(
                  (subscription.nextBillingDate - Date.now()) / (24 * 60 * 60 * 1000)
                );
                const isUnused = unusedSubs.some((u) => u.id === subscription.id);

                return (
                  <TouchableOpacity
                    key={subscription.id}
                    onPress={() => handleSubscriptionPress(subscription)}
                    className="bg-surface rounded-2xl p-4 border border-border"
                    style={{ opacity: 1 }}
                  >
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-2xl">{getCategoryIcon(subscription.category)}</Text>
                        <View>
                          <Text className="text-base font-semibold text-foreground">
                            {subscription.name}
                          </Text>
                          <Text className="text-xs text-muted">
                            {getCategoryLabel(subscription.category)}
                          </Text>
                        </View>
                      </View>
                      <View
                        className="px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: getStatusColor(subscription.status, colors) + "20",
                        }}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{ color: getStatusColor(subscription.status, colors) }}
                        >
                          {subscription.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {isUnused && (
                      <View className="bg-warning rounded-lg p-2 mb-2" style={{ opacity: 0.2 }}>
                        <Text className="text-xs font-medium text-warning text-center">
                          ⚠️ Unused for 30+ days
                        </Text>
                      </View>
                    )}

                    <View className="gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Cost</Text>
                        <Text className="text-sm font-medium text-foreground">
                          ${subscription.cost}/{subscription.billingCycle.slice(0, 1)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Monthly</Text>
                        <Text className="text-sm font-medium text-foreground">
                          ${monthlyCost.toFixed(2)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Annual</Text>
                        <Text className="text-sm font-medium text-foreground">
                          ${annualCost.toFixed(2)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Next Billing</Text>
                        <Text className="text-sm font-medium text-foreground">
                          {daysUntilRenewal > 0 ? `${daysUntilRenewal} days` : "Overdue"}
                        </Text>
                      </View>
                    </View>

                    {subscription.status === "active" && (
                      <View className="flex-row gap-2 mt-3">
                        <TouchableOpacity
                          onPress={() => handleFindAlternatives(subscription)}
                          className="flex-1 bg-primary rounded-lg p-2 items-center"
                          style={{ opacity: 0.8 }}
                        >
                          <Text className="text-white text-xs font-medium">Find Alternatives</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleCancelSubscription(subscription)}
                          className="flex-1 bg-error rounded-lg p-2 items-center"
                          style={{ opacity: 0.8 }}
                        >
                          <Text className="text-white text-xs font-medium">Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Category Spending */}
          {Object.keys(categorySpending).length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Spending by Category</Text>
              {Object.entries(categorySpending)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => (
                  <View
                    key={category}
                    className="bg-surface rounded-2xl p-4 border border-border flex-row justify-between items-center"
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-2xl">
                        {getCategoryIcon(category as Subscription["category"])}
                      </Text>
                      <Text className="text-sm font-medium text-foreground">
                        {getCategoryLabel(category as Subscription["category"])}
                      </Text>
                    </View>
                    <Text className="text-base font-bold text-foreground">
                      ${amount.toFixed(2)}/mo
                    </Text>
                  </View>
                ))}
            </View>
          )}

          {/* Selected Subscription Details */}
          {selectedSubscription && !showAlternativesModal && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Subscription Details</Text>
              <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
                {selectedSubscription.notes && (
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Notes</Text>
                    <Text className="text-sm text-muted">{selectedSubscription.notes}</Text>
                  </View>
                )}

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Auto-Renew</Text>
                  <Text className="text-sm text-muted">
                    {selectedSubscription.autoRenew ? "Enabled" : "Disabled"}
                  </Text>
                </View>

                {selectedSubscription.lastUsed && (
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Last Used</Text>
                    <Text className="text-sm text-muted">
                      {new Date(selectedSubscription.lastUsed).toLocaleDateString()}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => handleDeleteSubscription(selectedSubscription.id)}
                  className="bg-error rounded-xl p-3 items-center mt-2"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-white font-medium">Delete Subscription</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Subscription Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Add Subscription</Text>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Service Name</Text>
                  <TextInput
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                    placeholder="Netflix, Spotify, etc."
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Category</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["streaming", "music", "software", "fitness"] as const).map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setFormData({ ...formData, category: cat })}
                        className="px-4 py-2 rounded-full border"
                        style={{
                          backgroundColor:
                            formData.category === cat ? colors.primary : colors.surface,
                          borderColor: formData.category === cat ? colors.primary : colors.border,
                        }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: formData.category === cat ? "#FFFFFF" : colors.foreground,
                          }}
                        >
                          {getCategoryLabel(cat)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Cost ($)</Text>
                  <TextInput
                    value={formData.cost?.toString()}
                    onChangeText={(text) =>
                      setFormData({ ...formData, cost: parseFloat(text) || 0 })
                    }
                    placeholder="9.99"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Billing Cycle</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["monthly", "quarterly", "yearly"] as const).map((cycle) => (
                      <TouchableOpacity
                        key={cycle}
                        onPress={() => setFormData({ ...formData, billingCycle: cycle })}
                        className="px-4 py-2 rounded-full border"
                        style={{
                          backgroundColor:
                            formData.billingCycle === cycle ? colors.primary : colors.surface,
                          borderColor:
                            formData.billingCycle === cycle ? colors.primary : colors.border,
                        }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: formData.billingCycle === cycle ? "#FFFFFF" : colors.foreground,
                          }}
                        >
                          {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
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
                    onPress={handleAddSubscription}
                    className="flex-1 bg-primary rounded-xl p-4 items-center"
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

      {/* Alternatives Modal */}
      <Modal visible={showAlternativesModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "70%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Alternative Services</Text>
                {selectedSubscription && (
                  <Text className="text-sm text-muted">
                    Alternatives to {selectedSubscription.name}
                  </Text>
                )}

                {alternatives.length === 0 ? (
                  <View className="bg-surface rounded-2xl p-6 items-center border border-border">
                    <Text className="text-muted text-center">No alternatives found</Text>
                  </View>
                ) : (
                  alternatives.map((alt, index) => (
                    <View
                      key={index}
                      className="bg-surface rounded-2xl p-4 border border-border gap-2"
                    >
                      <View className="flex-row justify-between items-start">
                        <Text className="text-base font-semibold text-foreground">{alt.name}</Text>
                        <Text className="text-lg font-bold text-primary">${alt.cost}/mo</Text>
                      </View>

                      {alt.savings > 0 && (
                        <View className="bg-success rounded-lg p-2" style={{ opacity: 0.2 }}>
                          <Text className="text-xs font-medium text-success text-center">
                            Save ${alt.savings.toFixed(2)}/month
                          </Text>
                        </View>
                      )}

                      <View className="gap-1">
                        {alt.features.map((feature, idx) => (
                          <Text key={idx} className="text-sm text-muted">
                            • {feature}
                          </Text>
                        ))}
                      </View>
                    </View>
                  ))
                )}

                <TouchableOpacity
                  onPress={() => {
                    setShowAlternativesModal(false);
                    setSelectedSubscription(null);
                  }}
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
