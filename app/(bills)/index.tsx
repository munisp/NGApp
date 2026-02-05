import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavedBiller {
  id: string;
  name: string;
  category: 'electricity' | 'water' | 'internet' | 'phone' | 'gas' | 'cable';
  accountNumber: string;
  lastPaid?: string;
  amount?: number;
}

const BILLERS_STORAGE_KEY = 'savedBillers';

const categoryIcons: Record<SavedBiller['category'], string> = {
  electricity: '⚡',
  water: '💧',
  internet: '🌐',
  phone: '📱',
  gas: '🔥',
  cable: '📺',
};

export default function BillPaymentScreen() {
  const router = useRouter();
  const [billers, setBillers] = useState<SavedBiller[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBillers();
  }, []);

  const loadBillers = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(BILLERS_STORAGE_KEY);
      if (stored) {
        setBillers(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load billers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderBiller = ({ item }: { item: SavedBiller }) => {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(bills)/pay?billerId=${item.id}`)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
        style={{ opacity: 1 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="w-12 h-12 bg-primary/20 rounded-full items-center justify-center mr-3">
              <Text className="text-2xl">{categoryIcons[item.category]}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-base mb-1">
                {item.name}
              </Text>
              <Text className="text-muted text-sm">
                {item.category.charAt(0).toUpperCase() + item.category.slice(1)} • {item.accountNumber}
              </Text>
              {item.lastPaid && (
                <Text className="text-muted text-xs mt-1">
                  Last paid: {new Date(item.lastPaid).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
          <View className="items-end">
            {item.amount && (
              <Text className="text-foreground font-bold text-lg">
                ${item.amount.toFixed(2)}
              </Text>
            )}
            <Text className="text-primary text-sm font-medium mt-1">Pay Now →</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Bill Payments', headerShown: true }} />

      {/* Quick Actions */}
      <View className="flex-row gap-3 mb-6">
        <TouchableOpacity
          onPress={() => router.push('/(bills)/add-biller')}
          className="flex-1 bg-primary rounded-xl p-4 items-center"
          style={{ opacity: 1 }}
        >
          <Text className="text-3xl mb-2">➕</Text>
          <Text className="text-white font-semibold">Add Biller</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(bills)/history')}
          className="flex-1 bg-surface border border-border rounded-xl p-4 items-center"
          style={{ opacity: 1 }}
        >
          <Text className="text-3xl mb-2">📋</Text>
          <Text className="text-foreground font-semibold">History</Text>
        </TouchableOpacity>
      </View>

      {/* Saved Billers */}
      <Text className="text-foreground font-bold text-xl mb-4">Saved Billers</Text>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : billers.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">💳</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Saved Billers</Text>
          <Text className="text-muted text-center mb-6">
            Add your utility providers to pay bills quickly
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(bills)/add-biller')}
            className="bg-primary rounded-xl px-6 py-3"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold">Add Your First Biller</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={billers}
          renderItem={renderBiller}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}
