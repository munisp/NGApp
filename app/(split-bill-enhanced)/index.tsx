import { ScrollView, Text, View, Pressable, TextInput, Alert } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  createSplitBill,
  getSplitBills,
  getSplitBillStatistics,
  markParticipantPaid,
  sendReminder,
  cancelSplitBill,
  deleteSplitBill,
  getBillCompletionPercentage,
  formatSplitBill,
  calculateEqualSplit,
  validateCustomSplit,
  type SplitBill,
  type SplitBillParticipant,
} from "@/utils/split-bill-enhanced";

export default function SplitBillEnhancedScreen() {
  const colors = useColors();
  const [mode, setMode] = useState<"list" | "create" | "detail">("list");
  const [bills, setBills] = useState<SplitBill[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedBill, setSelectedBill] = useState<SplitBill | null>(null);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  
  // Create form state
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [description, setDescription] = useState("");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [participantCount, setParticipantCount] = useState("2");
  const [participants, setParticipants] = useState<Array<{ name: string; amount: string }>>([
    { name: "", amount: "" },
    { name: "", amount: "" },
  ]);

  const userId = "current_user"; // In production, get from auth context

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedBill) {
      loadBillDetails();
    }
  }, [selectedBill]);

  const loadData = async () => {
    const [allBills, statistics] = await Promise.all([
      getSplitBills(),
      getSplitBillStatistics(userId),
    ]);
    
    setBills(allBills.sort((a, b) => b.created_at - a.created_at));
    setStats(statistics);
  };

  const loadBillDetails = async () => {
    if (!selectedBill) return;
    
    const completion = await getBillCompletionPercentage(selectedBill.id);
    setCompletionPercentage(completion);
  };

  const handleCreateBill = async () => {
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }
    
    const validParticipants = participants.filter((p) => p.name.trim());
    if (validParticipants.length < 2) {
      Alert.alert("Error", "Please add at least 2 participants");
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      let customAmounts: number[] | undefined;
      
      if (splitType === "custom") {
        customAmounts = validParticipants.map((p) => parseFloat(p.amount) || 0);
        const validation = validateCustomSplit(amount, customAmounts);
        
        if (!validation.valid) {
          Alert.alert("Error", validation.error);
          return;
        }
      }
      
      await createSplitBill(
        title,
        amount,
        validParticipants.map((p) => ({ name: p.name })),
        splitType,
        customAmounts,
        description || undefined,
        "USD",
        userId
      );
      
      setMode("list");
      setTitle("");
      setTotalAmount("");
      setDescription("");
      setSplitType("equal");
      setParticipants([
        { name: "", amount: "" },
        { name: "", amount: "" },
      ]);
      
      await loadData();
      
      Alert.alert("Success", "Split bill created successfully");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create split bill");
    }
  };

  const handleMarkPaid = async (participantId: string) => {
    if (!selectedBill) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await markParticipantPaid(selectedBill.id, participantId);
      
      if (success) {
        const updatedBills = await getSplitBills();
        const updatedBill = updatedBills.find((b) => b.id === selectedBill.id);
        
        if (updatedBill) {
          setSelectedBill(updatedBill);
          setBills(updatedBills);
        }
        
        await loadData();
      } else {
        Alert.alert("Error", "Failed to mark as paid");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to mark as paid");
    }
  };

  const handleSendReminder = async () => {
    if (!selectedBill) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await sendReminder(selectedBill.id);
      
      if (result.success) {
        Alert.alert(
          "Reminders Sent",
          `Sent reminders to ${result.reminded_count} unpaid participants`
        );
        
        const updatedBills = await getSplitBills();
        const updatedBill = updatedBills.find((b) => b.id === selectedBill.id);
        
        if (updatedBill) {
          setSelectedBill(updatedBill);
        }
      } else {
        Alert.alert("Error", result.error || "Failed to send reminders");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send reminders");
    }
  };

  const handleCancelBill = async () => {
    if (!selectedBill) return;
    
    Alert.alert(
      "Cancel Bill",
      "Are you sure you want to cancel this split bill?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              const success = await cancelSplitBill(selectedBill.id);
              
              if (success) {
                setMode("list");
                setSelectedBill(null);
                await loadData();
                Alert.alert("Success", "Bill cancelled");
              } else {
                Alert.alert("Error", "Failed to cancel bill");
              }
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to cancel bill");
            }
          },
        },
      ]
    );
  };

  const handleDeleteBill = async () => {
    if (!selectedBill) return;
    
    Alert.alert(
      "Delete Bill",
      "Are you sure you want to delete this split bill?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              const success = await deleteSplitBill(selectedBill.id);
              
              if (success) {
                setMode("list");
                setSelectedBill(null);
                await loadData();
                Alert.alert("Success", "Bill deleted");
              } else {
                Alert.alert("Error", "Failed to delete bill");
              }
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to delete bill");
            }
          },
        },
      ]
    );
  };

  const addParticipant = () => {
    setParticipants([...participants, { name: "", amount: "" }]);
  };

  const removeParticipant = (index: number) => {
    if (participants.length <= 2) {
      Alert.alert("Error", "You need at least 2 participants");
      return;
    }
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: "name" | "amount", value: string) => {
    const updated = [...participants];
    updated[index][field] = value;
    setParticipants(updated);
  };

  const calculateSplitPreview = () => {
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) return null;
    
    if (splitType === "equal") {
      const validCount = participants.filter((p) => p.name.trim()).length;
      if (validCount === 0) return null;
      
      const perPerson = calculateEqualSplit(amount, validCount);
      return `$${perPerson.toFixed(2)} per person`;
    }
    
    return null;
  };

  if (mode === "create") {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Create Split Bill</Text>
              <Pressable onPress={() => setMode("list")}>
                <Text className="text-base text-muted">Cancel</Text>
              </Pressable>
            </View>

            <View className="gap-4">
              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Title *</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Restaurant dinner"
                  autoFocus
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Total Amount *</Text>
                <TextInput
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                  placeholder="100.00"
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
                {calculateSplitPreview() && (
                  <Text className="text-xs text-muted">{calculateSplitPreview()}</Text>
                )}
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  Description (Optional)
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What's this for?"
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Split Type</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setSplitType("equal")}
                    style={({ pressed }) => [
                      {
                        backgroundColor:
                          splitType === "equal" ? colors.primary : colors.surface,
                        borderColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="flex-1 rounded-xl py-3 border"
                  >
                    <Text
                      style={{
                        color: splitType === "equal" ? colors.background : colors.foreground,
                      }}
                      className="text-center font-semibold"
                    >
                      Equal
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSplitType("custom")}
                    style={({ pressed }) => [
                      {
                        backgroundColor:
                          splitType === "custom" ? colors.primary : colors.surface,
                        borderColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="flex-1 rounded-xl py-3 border"
                  >
                    <Text
                      style={{
                        color: splitType === "custom" ? colors.background : colors.foreground,
                      }}
                      className="text-center font-semibold"
                    >
                      Custom
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-foreground">Participants *</Text>
                  <Pressable onPress={addParticipant}>
                    <Text style={{ color: colors.primary }} className="text-sm font-semibold">
                      + Add
                    </Text>
                  </Pressable>
                </View>
                
                {participants.map((participant, index) => (
                  <View key={index} className="gap-2">
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <TextInput
                          value={participant.name}
                          onChangeText={(value) => updateParticipant(index, "name", value)}
                          placeholder={`Person ${index + 1}`}
                          style={{
                            backgroundColor: colors.surface,
                            color: colors.foreground,
                            borderColor: colors.border,
                          }}
                          className="border rounded-xl px-4 py-3 text-base"
                          placeholderTextColor={colors.muted}
                        />
                      </View>
                      {splitType === "custom" && (
                        <View className="w-24">
                          <TextInput
                            value={participant.amount}
                            onChangeText={(value) => updateParticipant(index, "amount", value)}
                            placeholder="0.00"
                            keyboardType="decimal-pad"
                            style={{
                              backgroundColor: colors.surface,
                              color: colors.foreground,
                              borderColor: colors.border,
                            }}
                            className="border rounded-xl px-4 py-3 text-base"
                            placeholderTextColor={colors.muted}
                          />
                        </View>
                      )}
                      {participants.length > 2 && (
                        <Pressable
                          onPress={() => removeParticipant(index)}
                          style={({ pressed }) => [
                            {
                              backgroundColor: colors.error + "20",
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                          className="w-12 h-12 rounded-xl items-center justify-center"
                        >
                          <Text style={{ color: colors.error }} className="text-lg">
                            ✕
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <Pressable
              onPress={handleCreateBill}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="rounded-xl py-4 mt-2"
            >
              <Text
                style={{ color: colors.background }}
                className="text-center font-semibold text-base"
              >
                Create Split Bill
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (mode === "detail" && selectedBill) {
    const formatted = formatSplitBill(selectedBill);
    
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => setMode("list")}>
                <Text className="text-base text-muted">← Back</Text>
              </Pressable>
              <Pressable onPress={handleDeleteBill}>
                <Text style={{ color: colors.error }} className="text-base font-semibold">
                  Delete
                </Text>
              </Pressable>
            </View>

            <View className="gap-2">
              <Text className="text-2xl font-bold text-foreground">{selectedBill.title}</Text>
              {selectedBill.description && (
                <Text className="text-sm text-muted">{selectedBill.description}</Text>
              )}
            </View>

            <View style={{ backgroundColor: colors.surface }} className="rounded-2xl p-6 border border-border">
              <Text className="text-4xl font-bold text-foreground mb-2">
                ${selectedBill.total_amount.toFixed(2)}
              </Text>
              <Text className="text-sm text-muted mb-4">{formatted.status_text}</Text>
              
              <View className="h-2 bg-background rounded-full overflow-hidden mb-2">
                <View
                  style={{
                    width: `${completionPercentage}%`,
                    backgroundColor: colors.success,
                  }}
                  className="h-full"
                />
              </View>
              <Text className="text-xs text-muted">{formatted.completion} completed</Text>
            </View>

            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-foreground">Participants</Text>
                {selectedBill.status !== "completed" && selectedBill.status !== "cancelled" && (
                  <Pressable onPress={handleSendReminder}>
                    <Text style={{ color: colors.primary }} className="text-sm font-semibold">
                      Send Reminder ({selectedBill.reminder_count}/3)
                    </Text>
                  </Pressable>
                )}
              </View>
              
              {selectedBill.participants.map((participant) => (
                <View
                  key={participant.id}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-xl p-4 border border-border"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {participant.name}
                      </Text>
                      <Text className="text-sm text-muted">
                        ${participant.amount.toFixed(2)}
                      </Text>
                      {participant.paid && participant.paid_at && (
                        <Text className="text-xs text-muted">
                          Paid {new Date(participant.paid_at).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    {participant.paid ? (
                      <View
                        style={{ backgroundColor: colors.success + "20" }}
                        className="px-3 py-1 rounded-full"
                      >
                        <Text style={{ color: colors.success }} className="text-xs font-semibold">
                          ✓ Paid
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleMarkPaid(participant.id)}
                        style={({ pressed }) => [
                          {
                            backgroundColor: colors.primary,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                        className="px-3 py-1 rounded-full"
                      >
                        <Text
                          style={{ color: colors.background }}
                          className="text-xs font-semibold"
                        >
                          Mark Paid
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {selectedBill.status !== "completed" && selectedBill.status !== "cancelled" && (
              <Pressable
                onPress={handleCancelBill}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.error + "20",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="rounded-xl py-3"
              >
                <Text style={{ color: colors.error }} className="text-center font-semibold">
                  Cancel Bill
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-2xl font-bold text-foreground">Split Bills</Text>
              <Text className="text-sm text-muted">Share expenses with friends</Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode("create");
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="px-4 py-2 rounded-full"
            >
              <Text style={{ color: colors.background }} className="font-semibold">
                + New
              </Text>
            </Pressable>
          </View>

          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Active Bills</Text>
                <Text className="text-2xl font-bold text-foreground">{stats.active_bills}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Pending</Text>
                <Text className="text-2xl font-bold text-foreground">
                  ${stats.total_amount_pending.toFixed(0)}
                </Text>
              </View>
            </View>
          )}

          {bills.length > 0 ? (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">All Bills</Text>
              {bills.map((bill) => {
                const formatted = formatSplitBill(bill);
                return (
                  <Pressable
                    key={bill.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedBill(bill);
                      setMode("detail");
                    }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.surface,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="rounded-xl p-4 border border-border"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-base font-semibold text-foreground flex-1">
                        {formatted.title}
                      </Text>
                      <Text className="text-lg font-bold text-foreground">
                        {formatted.amount}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">{formatted.participants_text}</Text>
                      <View
                        style={{
                          backgroundColor:
                            bill.status === "completed"
                              ? colors.success + "20"
                              : bill.status === "cancelled"
                              ? colors.error + "20"
                              : colors.warning + "20",
                        }}
                        className="px-2 py-1 rounded-full"
                      >
                        <Text
                          style={{
                            color:
                              bill.status === "completed"
                                ? colors.success
                                : bill.status === "cancelled"
                                ? colors.error
                                : colors.warning,
                          }}
                          className="text-xs font-semibold"
                        >
                          {formatted.status_text}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-6xl mb-4">💰</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No Split Bills Yet
              </Text>
              <Text className="text-sm text-muted text-center">
                Create your first split bill to share expenses with friends
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
