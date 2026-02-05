import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, TextInput } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  isMobileWalletAvailable,
  isMobileWalletEnabled,
  enableMobileWallet,
  disableMobileWallet,
  getWalletCards,
  addCardToWallet,
  removeCardFromWallet,
  setDefaultWalletCard,
  getWalletProviderName,
  getCardBrandName,
  showPaymentSheet,
  type WalletCard,
} from "@/utils/mobile-wallet";

export default function MobileWalletSettingsScreen() {
  const colors = useColors();
  const [isAvailable, setIsAvailable] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    const availability = await isMobileWalletAvailable();
    const enabled = await isMobileWalletEnabled();
    const walletCards = await getWalletCards();

    setIsAvailable(availability.available);
    if (availability.provider) {
      setProviderName(getWalletProviderName(availability.provider));
    }
    setIsEnabled(enabled);
    setCards(walletCards);
    setIsLoading(false);
  };

  const handleToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (value) {
      await enableMobileWallet();
      setIsEnabled(true);
      Alert.alert(
        "Enabled",
        `${providerName} has been enabled. You can now use it for payments.`
      );
    } else {
      Alert.alert(
        `Disable ${providerName}`,
        `Are you sure you want to disable ${providerName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              await disableMobileWallet();
              setIsEnabled(false);
            },
          },
        ]
      );
    }
  };

  const handleAddCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAddCard(true);
  };

  const handleRemoveCard = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    Alert.alert(
      "Remove Card",
      `Remove ${getCardBrandName(card.brand)} ending in ${card.lastFour}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await removeCardFromWallet(cardId);
            if (result.success) {
              await loadSettings();
              Alert.alert("Removed", "Card has been removed from your wallet");
            } else {
              Alert.alert("Error", result.error || "Failed to remove card");
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (cardId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setDefaultWalletCard(cardId);
    await loadSettings();
  };

  const handleTestPayment = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const result = await showPaymentSheet({
      amount: 10.00,
      currency: "USD",
      description: "Test Payment",
      merchantId: "merchant_test",
      merchantName: "Fintech App",
    });

    if (result.success) {
      Alert.alert(
        "Payment Successful",
        `Transaction ID: ${result.transactionId}\nPaid with ${result.paymentMethod?.brand} ending in ${result.paymentMethod?.lastFour}`
      );
    } else {
      Alert.alert("Payment Failed", result.error || "Unknown error");
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  if (!isAvailable) {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <Text className="text-2xl font-bold text-foreground">Mobile Wallet</Text>
            
            <View
              className="rounded-xl p-6 items-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-6xl mb-4">💳</Text>
              <Text className="text-lg font-semibold text-foreground text-center mb-2">
                Not Available
              </Text>
              <Text className="text-base text-muted text-center">
                Mobile wallet payments are not available on this device.
              </Text>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">{providerName}</Text>
            <Text className="text-base text-muted mt-2">
              Pay securely with your mobile wallet
            </Text>
          </View>

          {/* Main Toggle */}
          <View
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-lg font-semibold text-foreground mb-1">
                  Enable {providerName}
                </Text>
                <Text className="text-sm text-muted">
                  Use {providerName} for quick and secure payments
                </Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={handleToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={isEnabled ? "#FFFFFF" : "#F4F3F4"}
              />
            </View>
          </View>

          {/* Cards */}
          {isEnabled && (
            <View className="gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-foreground">Payment Methods</Text>
                <TouchableOpacity onPress={handleAddCard}>
                  <Text className="text-base font-semibold" style={{ color: colors.primary }}>
                    + Add Card
                  </Text>
                </TouchableOpacity>
              </View>

              {cards.length > 0 ? (
                <View className="gap-3">
                  {cards.map((card) => (
                    <View
                      key={card.id}
                      className="rounded-xl p-4 border"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: card.isDefault ? colors.primary : colors.border,
                        borderWidth: card.isDefault ? 2 : 1,
                      }}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-foreground">
                            {getCardBrandName(card.brand)} •••• {card.lastFour}
                          </Text>
                          <Text className="text-sm text-muted">
                            Expires {card.expiryMonth}/{card.expiryYear}
                          </Text>
                        </View>
                        {card.isDefault && (
                          <View
                            className="px-2 py-1 rounded"
                            style={{ backgroundColor: colors.primary + "20" }}
                          >
                            <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                              Default
                            </Text>
                          </View>
                        )}
                      </View>

                      <View className="flex-row gap-2">
                        {!card.isDefault && (
                          <TouchableOpacity
                            onPress={() => handleSetDefault(card.id)}
                            className="flex-1 rounded-lg p-2 items-center"
                            style={{ backgroundColor: colors.primary + "10" }}
                          >
                            <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                              Set Default
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => handleRemoveCard(card.id)}
                          className="flex-1 rounded-lg p-2 items-center"
                          style={{ backgroundColor: colors.error + "10" }}
                        >
                          <Text className="text-sm font-semibold" style={{ color: colors.error }}>
                            Remove
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  className="rounded-xl p-6 items-center"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Text className="text-base text-muted text-center">
                    No payment methods added yet
                  </Text>
                </View>
              )}

              {/* Test Payment */}
              {cards.length > 0 && (
                <TouchableOpacity
                  onPress={handleTestPayment}
                  className="rounded-xl p-4 items-center border"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                >
                  <Text className="text-base font-semibold text-foreground">
                    Test Payment ($10.00)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Features */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Features</Text>
            
            {[
              {
                icon: "⚡",
                title: "Fast Checkout",
                description: "Complete payments in seconds with a single tap",
              },
              {
                icon: "🔒",
                title: "Secure",
                description: "Your card details are never shared with merchants",
              },
              {
                icon: "📱",
                title: "Contactless",
                description: "Pay in stores by holding your phone near the terminal",
              },
              {
                icon: "🌐",
                title: "Online Payments",
                description: "Use for online shopping and in-app purchases",
              },
            ].map((feature, index) => (
              <View
                key={index}
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <View className="flex-row items-start gap-3">
                  <Text className="text-2xl">{feature.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground mb-1">
                      {feature.title}
                    </Text>
                    <Text className="text-sm text-muted">{feature.description}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Bottom Spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>

      {/* Add Card Modal (Simplified) */}
      {showAddCard && (
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View
            className="w-11/12 rounded-xl p-6"
            style={{ backgroundColor: colors.background }}
          >
            <Text className="text-xl font-bold text-foreground mb-4">Add Card</Text>
            <Text className="text-sm text-muted mb-4">
              This is a demo. In a real app, you would add cards through {providerName} settings.
            </Text>
            <TouchableOpacity
              onPress={async () => {
                const result = await addCardToWallet({
                  lastFour: String(Math.floor(1000 + Math.random() * 9000)),
                  brand: "visa",
                  expiryMonth: 12,
                  expiryYear: 2027,
                  isDefault: cards.length === 0,
                });
                
                if (result.success) {
                  await loadSettings();
                  setShowAddCard(false);
                  Alert.alert("Success", "Card added to your wallet");
                } else {
                  Alert.alert("Error", result.error || "Failed to add card");
                }
              }}
              className="rounded-xl p-4 items-center mb-2"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-base font-semibold text-white">Add Demo Card</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowAddCard(false)}
              className="rounded-xl p-4 items-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-base font-semibold text-foreground">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
