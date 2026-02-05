import { ScrollView, Text, View, Pressable, TextInput, Alert, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getPaymentRequests,
  createPaymentRequest,
  sendPaymentRequest,
  sendPaymentRequestReminder,
  cancelPaymentRequest,
  markPaymentRequestPaid,
  getPaymentRequestStats,
  type PaymentRequest,
} from "@/utils/payment-requests";

export default function PaymentRequestsScreen() {
  const colors = useColors();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form state
  const [amount, setAmount] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientContact, setRecipientContact] = useState("");
  const [contactType, setContactType] = useState<"email" | "sms">("email");
  const [description, setDescription] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [loadedRequests, loadedStats] = await Promise.all([
        getPaymentRequests(),
        getPaymentRequestStats(),
      ]);
      setRequests(loadedRequests.sort((a, b) => b.created_at - a.created_at));
      setStats(loadedStats);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!amount || !recipientName || !recipientContact || !description) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const request = await createPaymentRequest({
        amount: amountNum,
        currency: "$",
        recipient_name: recipientName,
        recipient_contact: recipientContact,
        contact_type: contactType,
        description,
      });

      // Send the request
      const sent = await sendPaymentRequest(request);
      
      if (sent) {
        Alert.alert("Success", "Payment request sent successfully!");
      } else {
        Alert.alert("Created", "Payment request created. You can send it manually from the list.");
      }

      // Reset form
      setAmount("");
      setRecipientName("");
      setRecipientContact("");
      setDescription("");
      setShowCreateForm(false);
      
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create payment request");
    }
  };

  const handleSendReminder = async (requestId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendPaymentRequestReminder(requestId);
      Alert.alert("Success", "Reminder sent!");
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send reminder");
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this payment request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            await cancelPaymentRequest(requestId);
            await loadData();
          },
        },
      ]
    );
  };

  const handleMarkPaid = async (requestId: string) => {
    Alert.alert(
      "Mark as Paid",
      "Has this payment been received?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            await markPaymentRequestPaid(requestId);
            await loadData();
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return colors.warning;
      case "paid":
        return colors.success;
      case "cancelled":
      case "expired":
        return colors.muted;
      default:
        return colors.foreground;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "paid":
        return "✅";
      case "cancelled":
        return "❌";
      case "expired":
        return "⏰";
      default:
        return "📄";
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-sm text-muted mt-4">Loading requests...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Payment Requests
            </Text>
            <Text className="text-sm text-muted">
              Request money from contacts via SMS or email
            </Text>
          </View>

          {/* Stats Cards */}
          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Pending</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.pending}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Received</Text>
                <Text className="text-xl font-bold text-foreground">
                  ${stats.total_amount_received.toFixed(2)}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Total</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.total}
                </Text>
              </View>
            </View>
          )}

          {/* Create Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCreateForm(!showCreateForm);
            }}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            className="rounded-full py-4"
          >
            <Text
              style={{ color: colors.background }}
              className="text-center font-semibold text-base"
            >
              {showCreateForm ? "Cancel" : "+ Create Payment Request"}
            </Text>
          </Pressable>

          {/* Create Form */}
          {showCreateForm && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-4">
              <Text className="text-lg font-semibold text-foreground">
                New Payment Request
              </Text>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Amount</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Recipient Name</Text>
                <TextInput
                  value={recipientName}
                  onChangeText={setRecipientName}
                  placeholder="John Doe"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Contact Method</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setContactType("email")}
                    style={{
                      backgroundColor: contactType === "email" ? colors.primary : colors.background,
                      borderColor: colors.border,
                    }}
                    className="flex-1 border rounded-xl py-3 items-center"
                  >
                    <Text
                      style={{
                        color: contactType === "email" ? colors.background : colors.foreground,
                      }}
                      className="font-semibold"
                    >
                      Email
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setContactType("sms")}
                    style={{
                      backgroundColor: contactType === "sms" ? colors.primary : colors.background,
                      borderColor: colors.border,
                    }}
                    className="flex-1 border rounded-xl py-3 items-center"
                  >
                    <Text
                      style={{
                        color: contactType === "sms" ? colors.background : colors.foreground,
                      }}
                      className="font-semibold"
                    >
                      SMS
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  {contactType === "email" ? "Email Address" : "Phone Number"}
                </Text>
                <TextInput
                  value={recipientContact}
                  onChangeText={setRecipientContact}
                  placeholder={contactType === "email" ? "john@example.com" : "+1234567890"}
                  keyboardType={contactType === "email" ? "email-address" : "phone-pad"}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What is this payment for?"
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                    textAlignVertical: "top",
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Pressable
                onPress={handleCreateRequest}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="rounded-xl py-4"
              >
                <Text
                  style={{ color: colors.background }}
                  className="text-center font-semibold text-base"
                >
                  Send Request
                </Text>
              </Pressable>
            </View>
          )}

          {/* Requests List */}
          {requests.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Your Requests
              </Text>

              {requests.map((request) => (
                <View
                  key={request.id}
                  className="bg-surface rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-start gap-3 mb-3">
                    <View
                      style={{ backgroundColor: getStatusColor(request.status) + "20" }}
                      className="w-12 h-12 rounded-full items-center justify-center"
                    >
                      <Text className="text-2xl">{getStatusIcon(request.status)}</Text>
                    </View>
                    
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground mb-1">
                        {request.recipient_name}
                      </Text>
                      <Text className="text-sm text-muted mb-1">
                        {request.description}
                      </Text>
                      <Text className="text-lg font-bold text-foreground">
                        {request.currency}{request.amount.toFixed(2)}
                      </Text>
                    </View>
                    
                    <View
                      style={{ backgroundColor: getStatusColor(request.status) + "20" }}
                      className="px-3 py-1 rounded-full"
                    >
                      <Text
                        style={{ color: getStatusColor(request.status) }}
                        className="text-xs font-semibold capitalize"
                      >
                        {request.status}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-xs text-muted">
                      Created {new Date(request.created_at).toLocaleDateString()}
                    </Text>
                    <Text className="text-xs text-muted">
                      Expires {new Date(request.expires_at).toLocaleDateString()}
                    </Text>
                  </View>

                  {request.status === "pending" && (
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => handleSendReminder(request.id)}
                        style={({ pressed }) => [
                          {
                            backgroundColor: colors.primary,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                        className="flex-1 py-2 rounded-lg"
                      >
                        <Text
                          style={{ color: colors.background }}
                          className="text-center text-sm font-semibold"
                        >
                          Send Reminder ({request.reminder_count}/3)
                        </Text>
                      </Pressable>
                      
                      <Pressable
                        onPress={() => handleMarkPaid(request.id)}
                        style={({ pressed }) => [
                          {
                            backgroundColor: colors.success,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                        className="flex-1 py-2 rounded-lg"
                      >
                        <Text
                          style={{ color: colors.background }}
                          className="text-center text-sm font-semibold"
                        >
                          Mark Paid
                        </Text>
                      </Pressable>
                      
                      <Pressable
                        onPress={() => handleCancelRequest(request.id)}
                        style={({ pressed }) => [
                          {
                            backgroundColor: colors.error,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                        className="px-4 py-2 rounded-lg"
                      >
                        <Text
                          style={{ color: colors.background }}
                          className="text-center text-sm font-semibold"
                        >
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {requests.length === 0 && !showCreateForm && (
            <View className="items-center justify-center py-12">
              <Text className="text-6xl mb-4">💸</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No payment requests yet
              </Text>
              <Text className="text-sm text-muted text-center">
                Create your first payment request to get started
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
