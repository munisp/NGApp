import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Card {
  id: string;
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cardType: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  isDefault: boolean;
  lastFourDigits: string;
  createdAt: string;
}

const CARDS_KEY = 'savedCards';

const cardTypeColors: Record<Card['cardType'], { bg: string; text: string }> = {
  visa: { bg: 'bg-blue-600', text: 'text-white' },
  mastercard: { bg: 'bg-red-600', text: 'text-white' },
  amex: { bg: 'bg-green-600', text: 'text-white' },
  discover: { bg: 'bg-orange-600', text: 'text-white' },
  other: { bg: 'bg-gray-600', text: 'text-white' },
};

const cardTypeLogos: Record<Card['cardType'], string> = {
  visa: 'VISA',
  mastercard: 'MC',
  amex: 'AMEX',
  discover: 'DISC',
  other: 'CARD',
};

export default function CardsScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(CARDS_KEY);
      if (stored) {
        setCards(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (cardId: string) => {
    try {
      const updatedCards = cards.map(card => ({
        ...card,
        isDefault: card.id === cardId,
      }));
      await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);
      Alert.alert('Success', 'Default card updated');
    } catch (error) {
      console.error('Failed to set default card:', error);
      Alert.alert('Error', 'Failed to update default card');
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    Alert.alert(
      'Delete Card',
      'Are you sure you want to remove this card?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedCards = cards.filter(card => card.id !== cardId);
              await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(updatedCards));
              setCards(updatedCards);
            } catch (error) {
              console.error('Failed to delete card:', error);
              Alert.alert('Error', 'Failed to delete card');
            }
          },
        },
      ]
    );
  };

  const maskCardNumber = (cardNumber: string): string => {
    return `•••• •••• •••• ${cardNumber.slice(-4)}`;
  };

  const renderCard = ({ item }: { item: Card }) => {
    const colors = cardTypeColors[item.cardType];
    
    return (
      <View className="mb-4">
        {/* Card Visual */}
        <View className={`${colors.bg} rounded-2xl p-6 mb-3 shadow-lg`}>
          <View className="flex-row justify-between items-start mb-8">
            <View className="bg-white/20 rounded px-3 py-1">
              <Text className={`${colors.text} font-bold text-sm`}>
                {cardTypeLogos[item.cardType]}
              </Text>
            </View>
            {item.isDefault && (
              <View className="bg-success rounded-full px-3 py-1">
                <Text className="text-white text-xs font-bold">DEFAULT</Text>
              </View>
            )}
          </View>

          <Text className={`${colors.text} text-2xl font-mono mb-4 tracking-widest`}>
            {maskCardNumber(item.cardNumber)}
          </Text>

          <View className="flex-row justify-between items-end">
            <View>
              <Text className={`${colors.text} opacity-70 text-xs mb-1`}>
                CARDHOLDER
              </Text>
              <Text className={`${colors.text} font-semibold text-base`}>
                {item.cardholderName}
              </Text>
            </View>
            <View>
              <Text className={`${colors.text} opacity-70 text-xs mb-1`}>
                EXPIRES
              </Text>
              <Text className={`${colors.text} font-semibold text-base`}>
                {item.expiryDate}
              </Text>
            </View>
          </View>
        </View>

        {/* Card Actions */}
        <View className="flex-row gap-2">
          {!item.isDefault && (
            <TouchableOpacity
              onPress={() => handleSetDefault(item.id)}
              className="flex-1 bg-primary/20 border border-primary rounded-xl py-3"
              style={{ opacity: 1 }}
            >
              <Text className="text-primary text-center font-semibold">
                Set as Default
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => handleDeleteCard(item.id)}
            className="flex-1 bg-error/20 border border-error rounded-xl py-3"
            style={{ opacity: 1 }}
          >
            <Text className="text-error text-center font-semibold">
              Remove
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'My Cards', headerShown: true }} />

      {/* Add Card Buttons */}
      <View className="flex-row gap-2 mb-6">
        <TouchableOpacity
          onPress={() => router.push('/(cards)/add')}
          className="flex-1 bg-primary rounded-xl p-4 flex-row items-center justify-center"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-2xl mr-2">+</Text>
          <Text className="text-white font-semibold text-base">Add Card</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(cards)/scan')}
          className="flex-1 bg-success rounded-xl p-4 flex-row items-center justify-center"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-2xl mr-2">📷</Text>
          <Text className="text-white font-semibold text-base">Scan Card</Text>
        </TouchableOpacity>
      </View>

      {/* Cards List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : cards.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">💳</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Cards Added</Text>
          <Text className="text-muted text-center mb-6">
            Add your debit or credit cards for quick payments
          </Text>
        </View>
      ) : (
        <>
          <Text className="text-muted text-sm mb-3">
            {cards.length} card{cards.length !== 1 ? 's' : ''} saved
          </Text>
          <FlatList
            data={cards}
            renderItem={renderCard}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </ScreenContainer>
  );
}
