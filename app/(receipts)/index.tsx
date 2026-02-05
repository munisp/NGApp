import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ScannedReceipt {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  category: string;
  imageUri: string;
  scannedAt: string;
}

export default function ReceiptsScreen() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<ScannedReceipt[]>([]);

  useEffect(() => {
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    try {
      const stored = await AsyncStorage.getItem('scannedReceipts');
      if (stored) {
        setReceipts(JSON.parse(stored));
      } else {
        // Sample receipts
        const sampleReceipts: ScannedReceipt[] = [
          {
            id: '1',
            merchant: 'Whole Foods Market',
            amount: 87.50,
            date: new Date().toISOString(),
            category: 'Food',
            imageUri: '',
            scannedAt: new Date().toISOString(),
          },
          {
            id: '2',
            merchant: 'Shell Gas Station',
            amount: 45.00,
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Transportation',
            imageUri: '',
            scannedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ];
        await AsyncStorage.setItem('scannedReceipts', JSON.stringify(sampleReceipts));
        setReceipts(sampleReceipts);
      }
    } catch (error) {
      console.error('Failed to load receipts:', error);
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      Food: '🍔',
      Shopping: '🛍️',
      Transportation: '🚗',
      Utilities: '💡',
      Entertainment: '🎬',
      Healthcare: '🏥',
      Other: '📄',
    };
    return icons[category] || '📄';
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Receipts', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Scanned Receipts</Text>
          <Text className="text-muted">View and manage your scanned receipts</Text>
        </View>

        {/* Scan Button */}
        <TouchableOpacity
          onPress={() => router.push('/(receipts)/scan' as any)}
          className="bg-primary rounded-xl p-5 mb-6 flex-row items-center justify-between"
          style={{ opacity: 1 }}
        >
          <View>
            <Text className="text-white font-bold text-xl mb-1">Scan New Receipt</Text>
            <Text className="text-white/80">Use camera or select from gallery</Text>
          </View>
          <Text className="text-white text-4xl">📸</Text>
        </TouchableOpacity>

        {/* Receipts List */}
        <View>
          <Text className="text-foreground font-bold text-xl mb-4">
            Recent Scans ({receipts.length})
          </Text>

          {receipts.map(receipt => (
            <TouchableOpacity
              key={receipt.id}
              onPress={() => router.push(`/(receipts)/${receipt.id}` as any)}
              className="bg-surface rounded-xl p-5 mb-3 border border-border"
              style={{ opacity: 1 }}
            >
              <View className="flex-row items-start">
                {/* Icon */}
                <View className="w-14 h-14 rounded-full bg-primary/20 items-center justify-center mr-4">
                  <Text className="text-3xl">{getCategoryIcon(receipt.category)}</Text>
                </View>

                {/* Details */}
                <View className="flex-1">
                  <Text className="text-foreground font-bold text-lg mb-1">
                    {receipt.merchant}
                  </Text>
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="bg-primary/20 px-3 py-1 rounded-full">
                      <Text className="text-primary text-xs font-semibold">
                        {receipt.category}
                      </Text>
                    </View>
                    <Text className="text-muted text-sm">
                      {new Date(receipt.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text className="text-muted text-sm">
                    Scanned {new Date(receipt.scannedAt).toLocaleDateString()}
                  </Text>
                </View>

                {/* Amount */}
                <Text className="text-foreground font-bold text-2xl">
                  ${receipt.amount.toFixed(2)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {receipts.length === 0 && (
            <View className="bg-surface rounded-xl p-12 items-center border border-border">
              <Text className="text-6xl mb-4">📸</Text>
              <Text className="text-foreground font-semibold text-lg mb-2">
                No Receipts Yet
              </Text>
              <Text className="text-muted text-center">
                Scan your first receipt to automatically track expenses
              </Text>
            </View>
          )}
        </View>

        {/* Stats */}
        {receipts.length > 0 && (
          <View className="mt-6 bg-primary/10 rounded-xl p-5 border border-primary/30">
            <Text className="text-foreground font-bold text-lg mb-4">This Month</Text>
            <View className="flex-row justify-between">
              <View>
                <Text className="text-muted mb-1">Total Scanned</Text>
                <Text className="text-foreground font-bold text-2xl">{receipts.length}</Text>
              </View>
              <View>
                <Text className="text-muted mb-1">Total Amount</Text>
                <Text className="text-foreground font-bold text-2xl">
                  ${receipts.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
