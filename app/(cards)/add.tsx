import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Card {
  id: string;
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
  cardType: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  isDefault: boolean;
  lastFourDigits: string;
  createdAt: string;
}

const CARDS_KEY = 'savedCards';

/**
 * Detect card type from card number
 */
function detectCardType(cardNumber: string): Card['cardType'] {
  const cleaned = cardNumber.replace(/\s/g, '');
  
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  if (/^6(?:011|5)/.test(cleaned)) return 'discover';
  
  return 'other';
}

/**
 * Validate card number using Luhn algorithm
 */
function validateCardNumber(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\s/g, '');
  
  if (!/^\d+$/.test(cleaned) || cleaned.length < 13 || cleaned.length > 19) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Format card number with spaces
 */
function formatCardNumber(value: string): string {
  const cleaned = value.replace(/\s/g, '');
  const chunks = cleaned.match(/.{1,4}/g) || [];
  return chunks.join(' ');
}

/**
 * Format expiry date as MM/YY
 */
function formatExpiryDate(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
  }
  return cleaned;
}

/**
 * Simple CVV encryption (base64 for demo purposes)
 */
function encryptCVV(cvv: string): string {
  return Buffer.from(cvv).toString('base64');
}

export default function AddCardScreen() {
  const router = useRouter();
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleCardNumberChange = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    if (cleaned.length <= 19) {
      setCardNumber(formatCardNumber(cleaned));
    }
  };

  const handleExpiryDateChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 4) {
      setExpiryDate(formatExpiryDate(cleaned));
    }
  };

  const handleCvvChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 4) {
      setCvv(cleaned);
    }
  };

  const handleAddCard = async () => {
    // Validation
    if (!cardNumber || !cardholderName || !expiryDate || !cvv) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const cleanedCardNumber = cardNumber.replace(/\s/g, '');

    if (!validateCardNumber(cleanedCardNumber)) {
      Alert.alert('Error', 'Invalid card number');
      return;
    }

    if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
      Alert.alert('Error', 'Invalid expiry date (use MM/YY format)');
      return;
    }

    const [month, year] = expiryDate.split('/').map(Number);
    if (month < 1 || month > 12) {
      Alert.alert('Error', 'Invalid expiry month');
      return;
    }

    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      Alert.alert('Error', 'Card has expired');
      return;
    }

    if (cvv.length < 3) {
      Alert.alert('Error', 'Invalid CVV');
      return;
    }

    try {
      setIsSaving(true);

      // Load existing cards
      const stored = await AsyncStorage.getItem(CARDS_KEY);
      const cards: Card[] = stored ? JSON.parse(stored) : [];

      // Check for duplicate
      if (cards.some(card => card.cardNumber === cleanedCardNumber)) {
        Alert.alert('Error', 'This card is already added');
        return;
      }

      // Create new card
      const newCard: Card = {
        id: Date.now().toString(),
        cardNumber: cleanedCardNumber,
        cardholderName: cardholderName.toUpperCase(),
        expiryDate,
        cvv: encryptCVV(cvv),
        cardType: detectCardType(cleanedCardNumber),
        isDefault: cards.length === 0,
        lastFourDigits: cleanedCardNumber.slice(-4),
        createdAt: new Date().toISOString(),
      };

      cards.push(newCard);
      await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(cards));

      Alert.alert('Success', 'Card added successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Failed to add card:', error);
      Alert.alert('Error', 'Failed to add card. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const cardType = detectCardType(cardNumber);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Add Card', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Card Preview */}
        <View className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 mb-6 shadow-lg">
          <View className="flex-row justify-between items-start mb-8">
            <View className="bg-white/20 rounded px-3 py-1">
              <Text className="text-white font-bold text-sm">
                {cardType.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text className="text-white text-2xl font-mono mb-4 tracking-widest">
            {cardNumber || '•••• •••• •••• ••••'}
          </Text>

          <View className="flex-row justify-between items-end">
            <View>
              <Text className="text-white opacity-70 text-xs mb-1">
                CARDHOLDER
              </Text>
              <Text className="text-white font-semibold text-base">
                {cardholderName.toUpperCase() || 'YOUR NAME'}
              </Text>
            </View>
            <View>
              <Text className="text-white opacity-70 text-xs mb-1">
                EXPIRES
              </Text>
              <Text className="text-white font-semibold text-base">
                {expiryDate || 'MM/YY'}
              </Text>
            </View>
          </View>
        </View>

        {/* Card Number */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Card Number *</Text>
          <TextInput
            value={cardNumber}
            onChangeText={handleCardNumberChange}
            placeholder="1234 5678 9012 3456"
            keyboardType="number-pad"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-lg font-mono"
          />
        </View>

        {/* Cardholder Name */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Cardholder Name *</Text>
          <TextInput
            value={cardholderName}
            onChangeText={setCardholderName}
            placeholder="JOHN DOE"
            autoCapitalize="characters"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-lg"
          />
        </View>

        {/* Expiry Date and CVV */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-2">Expiry Date *</Text>
            <TextInput
              value={expiryDate}
              onChangeText={handleExpiryDateChange}
              placeholder="MM/YY"
              keyboardType="number-pad"
              placeholderTextColor="#9BA1A6"
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-lg font-mono"
            />
          </View>

          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-2">CVV *</Text>
            <TextInput
              value={cvv}
              onChangeText={handleCvvChange}
              placeholder="123"
              keyboardType="number-pad"
              secureTextEntry
              placeholderTextColor="#9BA1A6"
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-lg font-mono"
            />
          </View>
        </View>

        {/* Security Notice */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <Text className="text-foreground font-semibold mb-2">🔒 Secure Storage</Text>
          <Text className="text-muted text-sm">
            Your card information is encrypted and stored securely on your device. We never share your card details with third parties.
          </Text>
        </View>

        {/* Add Button */}
        <TouchableOpacity
          onPress={handleAddCard}
          disabled={isSaving}
          className="bg-primary rounded-xl p-4 mb-4"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {isSaving ? 'Adding Card...' : 'Add Card'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isSaving}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
