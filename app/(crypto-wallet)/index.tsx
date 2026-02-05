import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import {
  getCryptoWallets,
  connectCryptoWallet,
  disconnectCryptoWallet,
  updateWalletPrices,
  getCryptoAllocation,
  type CryptoWallet,
} from "@/utils/crypto-wallet";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export default function CryptoWalletScreen() {
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [allocation, setAllocation] = useState<{ symbol: string; name: string; percentage: number; value_usd: number }[]>([]);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [walletName, setWalletName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletType, setWalletType] = useState<CryptoWallet["type"]>("metamask");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWallets();
  }, []);

  async function loadWallets() {
    try {
      const loadedWallets = await getCryptoWallets();
      setWallets(loadedWallets);
      
      const alloc = await getCryptoAllocation();
      setAllocation(alloc);
    } catch (error) {
      console.error("Error loading wallets:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    
    // Update prices for all wallets
    for (const wallet of wallets) {
      await updateWalletPrices(wallet.id);
    }
    
    await loadWallets();
    setRefreshing(false);
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  async function handleConnectWallet() {
    if (!walletName.trim() || !walletAddress.trim()) {
      Alert.alert("Error", "Please enter wallet name and address");
      return;
    }

    try {
      await connectCryptoWallet(walletName, walletType, walletAddress);
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert("Success", "Wallet connected successfully");
      setShowAddWallet(false);
      setWalletName("");
      setWalletAddress("");
      loadWallets();
    } catch (error) {
      Alert.alert("Error", "Failed to connect wallet");
    }
  }

  async function handleDisconnectWallet(walletId: string) {
    Alert.alert(
      "Disconnect Wallet",
      "Are you sure you want to disconnect this wallet?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            await disconnectCryptoWallet(walletId);
            loadWallets();
            
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  }

  const totalValue = wallets.reduce((sum, w) => sum + w.total_value_usd, 0);

  if (loading) {
    return (
      <ScreenContainer className="p-6 justify-center items-center">
        <Text className="text-foreground text-lg">Loading wallets...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView
        className="flex-1 p-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Crypto Wallets</Text>
          <Text className="text-muted">Connect and manage your cryptocurrency wallets</Text>
        </View>

        {/* Total Portfolio Value */}
        <View className="bg-primary p-6 rounded-2xl mb-6">
          <Text className="text-white text-sm mb-1">Total Portfolio Value</Text>
          <Text className="text-white text-4xl font-bold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>

        {/* Portfolio Allocation */}
        {allocation.length > 0 && (
          <View className="bg-surface p-6 rounded-2xl mb-6 border border-border">
            <Text className="text-foreground text-lg font-semibold mb-4">Portfolio Allocation</Text>
            {allocation.map((asset) => (
              <View key={asset.symbol} className="mb-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-foreground font-medium">{asset.symbol}</Text>
                  <Text className="text-muted">{asset.percentage.toFixed(1)}%</Text>
                </View>
                <View className="h-2 bg-border rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary"
                    style={{ width: `${asset.percentage}%` }}
                  />
                </View>
                <Text className="text-muted text-sm mt-1">${asset.value_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Connected Wallets */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-semibold mb-4">Connected Wallets</Text>
          
          {wallets.length === 0 ? (
            <View className="bg-surface p-6 rounded-2xl border border-border items-center">
              <Text className="text-muted text-center mb-2">No wallets connected</Text>
              <Text className="text-muted text-sm text-center">Connect your first crypto wallet to get started</Text>
            </View>
          ) : (
            wallets.map((wallet) => (
              <View key={wallet.id} className="bg-surface p-6 rounded-2xl mb-4 border border-border">
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-1">
                    <Text className="text-foreground text-lg font-semibold mb-1">{wallet.name}</Text>
                    <Text className="text-muted text-sm mb-1 capitalize">{wallet.type.replace("_", " ")}</Text>
                    <Text className="text-muted text-xs">{wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}</Text>
                  </View>
                  <TouchableOpacity
                    className="bg-error px-4 py-2 rounded-lg"
                    onPress={() => handleDisconnectWallet(wallet.id)}
                  >
                    <Text className="text-white font-medium">Disconnect</Text>
                  </TouchableOpacity>
                </View>

                <View className="border-t border-border pt-4">
                  <Text className="text-foreground font-semibold mb-3">Assets</Text>
                  {wallet.assets.map((asset) => (
                    <View key={asset.id} className="flex-row justify-between items-center mb-3">
                      <View className="flex-1">
                        <Text className="text-foreground font-medium">{asset.symbol}</Text>
                        <Text className="text-muted text-sm">{asset.balance} {asset.symbol}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-foreground font-medium">${asset.value_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        <Text className={`text-sm ${asset.change_24h >= 0 ? "text-success" : "text-error"}`}>
                          {asset.change_24h >= 0 ? "+" : ""}{asset.change_24h.toFixed(2)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View className="border-t border-border pt-4 mt-2">
                  <View className="flex-row justify-between">
                    <Text className="text-muted">Total Value</Text>
                    <Text className="text-foreground font-bold text-lg">${wallet.total_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Add Wallet Form */}
        {showAddWallet ? (
          <View className="bg-surface p-6 rounded-2xl border border-border mb-6">
            <Text className="text-foreground text-lg font-semibold mb-4">Connect New Wallet</Text>

            <Text className="text-foreground font-medium mb-2">Wallet Name</Text>
            <TextInput
              className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-4"
              placeholder="My Crypto Wallet"
              placeholderTextColor="#9BA1A6"
              value={walletName}
              onChangeText={setWalletName}
            />

            <Text className="text-foreground font-medium mb-2">Wallet Type</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(["metamask", "trust_wallet", "coinbase", "custom"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  className={`px-4 py-2 rounded-lg ${walletType === type ? "bg-primary" : "bg-background border border-border"}`}
                  onPress={() => setWalletType(type)}
                >
                  <Text className={walletType === type ? "text-white font-medium" : "text-foreground"}>
                    {type.replace("_", " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-foreground font-medium mb-2">Wallet Address</Text>
            <TextInput
              className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-4"
              placeholder="0x..."
              placeholderTextColor="#9BA1A6"
              value={walletAddress}
              onChangeText={setWalletAddress}
              autoCapitalize="none"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-background border border-border py-3 rounded-lg"
                onPress={() => {
                  setShowAddWallet(false);
                  setWalletName("");
                  setWalletAddress("");
                }}
              >
                <Text className="text-foreground text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-primary py-3 rounded-lg"
                onPress={handleConnectWallet}
              >
                <Text className="text-white text-center font-medium">Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            className="bg-primary py-4 rounded-lg mb-6"
            onPress={() => setShowAddWallet(true)}
          >
            <Text className="text-white text-center font-semibold text-lg">+ Connect Wallet</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
