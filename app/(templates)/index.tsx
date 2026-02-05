import { ScrollView, Text, View, Pressable, TextInput, Alert, Switch } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getPaymentTemplates,
  createPaymentTemplate,
  deletePaymentTemplate,
  toggleTemplateFavorite,
  recordTemplateUsage,
  getFavoriteTemplates,
  getRecentTemplates,
  type PaymentTemplate,
} from "@/utils/payment-templates";

export default function PaymentTemplatesScreen() {
  const colors = useColors();
  const [templates, setTemplates] = useState<PaymentTemplate[]>([]);
  const [favorites, setFavorites] = useState<PaymentTemplate[]>([]);
  const [recent, setRecent] = useState<PaymentTemplate[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const [allTemplates, favTemplates, recentTemplates] = await Promise.all([
      getPaymentTemplates(),
      getFavoriteTemplates(),
      getRecentTemplates(3),
    ]);
    
    setTemplates(allTemplates);
    setFavorites(favTemplates);
    setRecent(recentTemplates);
  };

  const handleCreateTemplate = async () => {
    if (!name || !recipientName || !recipientAccount || !amount) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await createPaymentTemplate({
        name,
        recipient_name: recipientName,
        recipient_account: recipientAccount,
        amount: amountNum,
        currency: "$",
        description,
        category,
      });

      Alert.alert("Success", "Payment template created!");
      
      // Reset form
      setName("");
      setRecipientName("");
      setRecipientAccount("");
      setAmount("");
      setDescription("");
      setCategory("other");
      setShowCreateForm(false);
      
      await loadTemplates();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create template");
    }
  };

  const handleUseTemplate = async (template: PaymentTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      "Use Template",
      `Send $${template.amount.toFixed(2)} to ${template.recipient_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            await recordTemplateUsage(template.id);
            
            // In production, this would trigger the actual payment
            Alert.alert("Success", "Payment sent successfully!");
            await loadTemplates();
          },
        },
      ]
    );
  };

  const handleToggleFavorite = async (templateId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleTemplateFavorite(templateId);
    await loadTemplates();
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    Alert.alert(
      "Delete Template",
      `Are you sure you want to delete "${templateName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deletePaymentTemplate(templateId);
            await loadTemplates();
          },
        },
      ]
    );
  };

  const renderTemplate = (template: PaymentTemplate, showFavorite: boolean = true) => (
    <View
      key={template.id}
      className="bg-surface rounded-2xl p-4 border border-border"
    >
      <View className="flex-row items-start gap-3 mb-3">
        <View
          style={{ backgroundColor: colors.primary + "20" }}
          className="w-12 h-12 rounded-full items-center justify-center"
        >
          <Text className="text-2xl">💳</Text>
        </View>
        
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground mb-1">
            {template.name}
          </Text>
          <Text className="text-sm text-muted mb-1">
            To: {template.recipient_name}
          </Text>
          <Text className="text-lg font-bold text-foreground">
            ${template.amount.toFixed(2)}
          </Text>
        </View>
        
        {showFavorite && (
          <Pressable
            onPress={() => handleToggleFavorite(template.id)}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text className="text-2xl">
              {template.is_favorite ? "⭐" : "☆"}
            </Text>
          </Pressable>
        )}
      </View>

      {template.description && (
        <Text className="text-sm text-muted mb-3">
          {template.description}
        </Text>
      )}

      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs text-muted">
          Used {template.use_count} times
        </Text>
        {template.last_used && (
          <Text className="text-xs text-muted">
            Last used {new Date(template.last_used).toLocaleDateString()}
          </Text>
        )}
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={() => handleUseTemplate(template)}
          style={({ pressed }) => [
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          className="flex-1 py-3 rounded-xl"
        >
          <Text
            style={{ color: colors.background }}
            className="text-center font-semibold"
          >
            Use Template
          </Text>
        </Pressable>
        
        <Pressable
          onPress={() => handleDeleteTemplate(template.id, template.name)}
          style={({ pressed }) => [
            {
              backgroundColor: colors.error,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          className="px-4 py-3 rounded-xl"
        >
          <Text
            style={{ color: colors.background }}
            className="text-center font-semibold"
          >
            Delete
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Payment Templates
            </Text>
            <Text className="text-sm text-muted">
              Save frequent payments for one-tap sending
            </Text>
          </View>

          {/* Stats Card */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Total Templates</Text>
              <Text className="text-xl font-bold text-foreground">
                {templates.length}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Favorites</Text>
              <Text className="text-xl font-bold text-foreground">
                {favorites.length}
              </Text>
            </View>
          </View>

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
              {showCreateForm ? "Cancel" : "+ Create Template"}
            </Text>
          </Pressable>

          {/* Create Form */}
          {showCreateForm && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-4">
              <Text className="text-lg font-semibold text-foreground">
                New Payment Template
              </Text>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Template Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Monthly Rent"
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
                <Text className="text-sm font-medium text-foreground">Account Number</Text>
                <TextInput
                  value={recipientAccount}
                  onChangeText={setRecipientAccount}
                  placeholder="1234567890"
                  keyboardType="numeric"
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
                <Text className="text-sm font-medium text-foreground">Description (Optional)</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Payment description"
                  multiline
                  numberOfLines={2}
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
                onPress={handleCreateTemplate}
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
                  Create Template
                </Text>
              </Pressable>
            </View>
          )}

          {/* Recent Templates */}
          {recent.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Recently Used
              </Text>
              {recent.map((template) => renderTemplate(template))}
            </View>
          )}

          {/* Favorite Templates */}
          {favorites.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Favorites
              </Text>
              {favorites.map((template) => renderTemplate(template, false))}
            </View>
          )}

          {/* All Templates */}
          {templates.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                All Templates
              </Text>
              {templates.map((template) => renderTemplate(template))}
            </View>
          )}

          {/* Empty State */}
          {templates.length === 0 && !showCreateForm && (
            <View className="items-center justify-center py-12">
              <Text className="text-6xl mb-4">💳</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No templates yet
              </Text>
              <Text className="text-sm text-muted text-center">
                Create your first payment template for quick transfers
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
