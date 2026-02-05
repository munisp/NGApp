import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { paymentService, PaymentMethod } from '@/lib/api/services-mock';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      if (!isAuthenticated) {
        Alert.alert('Error', 'Please log in to view payment methods');
        return;
      }

      setLoading(true);
      const data = await paymentService.getPaymentMethods();
      setMethods(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMethod = async (id: string) => {
    Alert.alert(
      'Remove Payment Method',
      'This feature will be available soon',
      [{ text: 'OK' }]
    );
  };

  const getMethodIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'card':
        return '💳';
      case 'bank':
        return '🏦';
      case 'mobile_money':
        return '📱';
      default:
        return '💰';
    }
  };

  const renderMethod = ({ item }: { item: PaymentMethod }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <Text className="text-3xl mr-3">{getMethodIcon(item.type)}</Text>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">{item.provider}</Text>
            <Text className="text-sm text-muted">**** {item.last_four}</Text>
            {item.is_default && (
              <View className="bg-primary/20 px-2 py-1 rounded-full mt-1 self-start">
                <Text className="text-primary text-xs font-medium">Default</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleRemoveMethod(item.id)}
          className="ml-2 p-2"
          style={{ opacity: 1 }}
        >
          <Text className="text-error text-lg">🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Payment Methods' }} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text className="text-muted mt-4">Loading payment methods...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Payment Methods' }} />

      {/* Add New Method Button */}
      <TouchableOpacity
        onPress={() => router.push('/(payment)/add-method')}
        className="bg-primary rounded-xl p-4 mb-6 flex-row items-center justify-center"
        style={{ opacity: 1 }}
      >
        <Text className="text-2xl mr-2">➕</Text>
        <Text className="text-white text-lg font-semibold">Add Payment Method</Text>
      </TouchableOpacity>

      {/* Payment Methods List */}
      <FlatList
        data={methods}
        renderItem={renderMethod}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <Text className="text-6xl mb-4">💳</Text>
            <Text className="text-xl font-semibold text-foreground mb-2">No Payment Methods</Text>
            <Text className="text-muted text-center">
              Add a payment method to start making transactions
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
