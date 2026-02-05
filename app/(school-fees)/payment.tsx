import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { router, useLocalSearchParams } from 'expo-router';

type PaymentMethod = 'card' | 'bank_transfer' | 'ussd' | 'wallet';

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: string;
  processingTime: string;
}

interface CardDetails {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

export default function PaymentScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const applicationId = params.applicationId as string;
  const paymentAmount = parseFloat(params.amount as string) || 0;

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card');
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bankCode, setBankCode] = useState('');
  const [ussdCode, setUssdCode] = useState('');

  const paymentMethods: PaymentMethodOption[] = [
    {
      id: 'card',
      name: 'Debit/Credit Card',
      description: 'Pay with your card',
      icon: '💳',
      processingTime: 'Instant',
    },
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      description: 'Transfer from your bank',
      icon: '🏦',
      processingTime: '5-10 minutes',
    },
    {
      id: 'ussd',
      name: 'USSD',
      description: 'Pay with USSD code',
      icon: '📱',
      processingTime: 'Instant',
    },
    {
      id: 'wallet',
      name: 'Wallet',
      description: 'Use your wallet balance',
      icon: '👛',
      processingTime: 'Instant',
    },
  ];

  useEffect(() => {
    if (selectedMethod === 'ussd') {
      generateUSSDCode();
    } else if (selectedMethod === 'bank_transfer') {
      generateBankTransferCode();
    }
  }, [selectedMethod]);

  const generateUSSDCode = () => {
    // Generate USSD code based on selected bank
    const code = `*737*50*${paymentAmount}*${applicationId.slice(0, 8)}#`;
    setUssdCode(code);
  };

  const generateBankTransferCode = () => {
    // Generate unique bank transfer reference
    const code = `SFEE${applicationId.slice(0, 8).toUpperCase()}`;
    setBankCode(code);
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ');
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const validateCardDetails = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Card number validation
    const cardNumber = cardDetails.cardNumber.replace(/\s/g, '');
    if (!cardNumber) {
      newErrors.cardNumber = 'Card number is required';
    } else if (cardNumber.length < 15 || cardNumber.length > 16) {
      newErrors.cardNumber = 'Invalid card number';
    }

    // Expiry date validation
    if (!cardDetails.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    } else {
      const [month, year] = cardDetails.expiryDate.split('/');
      const currentYear = new Date().getFullYear() % 100;
      const currentMonth = new Date().getMonth() + 1;
      
      if (!month || !year || parseInt(month) < 1 || parseInt(month) > 12) {
        newErrors.expiryDate = 'Invalid expiry date';
      } else if (parseInt(year) < currentYear || (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
        newErrors.expiryDate = 'Card has expired';
      }
    }

    // CVV validation
    if (!cardDetails.cvv) {
      newErrors.cvv = 'CVV is required';
    } else if (cardDetails.cvv.length < 3 || cardDetails.cvv.length > 4) {
      newErrors.cvv = 'Invalid CVV';
    }

    // Cardholder name validation
    if (!cardDetails.cardholderName.trim()) {
      newErrors.cardholderName = 'Cardholder name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCardPayment = async () => {
    if (!validateCardDetails()) {
      Alert.alert('Validation Error', 'Please fix the errors before proceeding');
      return;
    }

    try {
      setProcessing(true);

      // In production: POST to payment gateway API
      const paymentData = {
        applicationId,
        amount: paymentAmount,
        method: 'card',
        cardDetails: {
          ...cardDetails,
          cardNumber: cardDetails.cardNumber.replace(/\s/g, ''),
        },
      };

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 3000));

      Alert.alert(
        'Payment Successful',
        `Your payment of ${formatCurrency(paymentAmount)} has been processed successfully!`,
        [
          {
            text: 'View Receipt',
            onPress: () => {
              router.back();
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Payment Failed', 'Unable to process your payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleBankTransferPayment = () => {
    Alert.alert(
      'Bank Transfer Instructions',
      `Please transfer ${formatCurrency(paymentAmount)} to:\n\nBank: First Bank of Nigeria\nAccount Number: 1234567890\nAccount Name: School Fees Platform\nReference: ${bankCode}\n\nYour payment will be confirmed within 5-10 minutes.`,
      [
        {
          text: 'I have made the transfer',
          onPress: () => {
            router.back();
            router.back();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleUSSDPayment = () => {
    Alert.alert(
      'USSD Payment',
      `Dial the following code on your phone:\n\n${ussdCode}\n\nFollow the prompts to complete your payment.`,
      [
        {
          text: 'I have dialed the code',
          onPress: () => {
            router.back();
            router.back();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleWalletPayment = async () => {
    try {
      setProcessing(true);

      // In production: POST to wallet API
      const paymentData = {
        applicationId,
        amount: paymentAmount,
        method: 'wallet',
      };

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      Alert.alert(
        'Payment Successful',
        `Your payment of ${formatCurrency(paymentAmount)} has been deducted from your wallet!`,
        [
          {
            text: 'View Receipt',
            onPress: () => {
              router.back();
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Payment Failed', 'Insufficient wallet balance or payment error.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayment = () => {
    switch (selectedMethod) {
      case 'card':
        handleCardPayment();
        break;
      case 'bank_transfer':
        handleBankTransferPayment();
        break;
      case 'ussd':
        handleUSSDPayment();
        break;
      case 'wallet':
        handleWalletPayment();
        break;
    }
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 py-6 bg-surface border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-base text-primary">← Back</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">Make Payment</Text>
          <View className="mt-4 p-4 rounded-2xl bg-primary/10 border border-primary">
            <Text className="text-sm text-muted mb-1">Amount to Pay</Text>
            <Text className="text-3xl font-bold text-primary">{formatCurrency(paymentAmount)}</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View className="px-4 py-6">
          <Text className="text-xl font-semibold text-foreground mb-4">Select Payment Method</Text>
          <View className="gap-3 mb-6">
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                onPress={() => setSelectedMethod(method.id)}
                className={`rounded-2xl p-4 border ${
                  selectedMethod === method.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-surface border-border'
                }`}
              >
                <View className="flex-row items-center">
                  <Text className="text-3xl mr-3">{method.icon}</Text>
                  <View className="flex-1">
                    <Text className={`text-base font-semibold ${
                      selectedMethod === method.id ? 'text-primary' : 'text-foreground'
                    }`}>
                      {method.name}
                    </Text>
                    <Text className="text-sm text-muted mt-1">{method.description}</Text>
                    <Text className="text-xs text-muted mt-1">
                      Processing: {method.processingTime}
                    </Text>
                  </View>
                  {selectedMethod === method.id && (
                    <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                      <Text className="text-background text-xs">✓</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payment Details Form */}
          {selectedMethod === 'card' && (
            <View className="gap-4">
              <Text className="text-xl font-semibold text-foreground">Card Details</Text>

              {/* Card Number */}
              <View>
                <Text className="text-sm font-medium text-foreground mb-2">Card Number *</Text>
                <TextInput
                  className={`px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                    errors.cardNumber ? 'border-error' : 'border-border'
                  }`}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  maxLength={19}
                  value={cardDetails.cardNumber}
                  onChangeText={(text) => {
                    const formatted = formatCardNumber(text.replace(/\D/g, ''));
                    setCardDetails({ ...cardDetails, cardNumber: formatted });
                    if (errors.cardNumber) {
                      setErrors({ ...errors, cardNumber: '' });
                    }
                  }}
                />
                {errors.cardNumber && (
                  <Text className="mt-1 text-xs text-error">{errors.cardNumber}</Text>
                )}
              </View>

              {/* Expiry Date and CVV */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground mb-2">Expiry Date *</Text>
                  <TextInput
                    className={`px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                      errors.expiryDate ? 'border-error' : 'border-border'
                    }`}
                    placeholder="MM/YY"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    maxLength={5}
                    value={cardDetails.expiryDate}
                    onChangeText={(text) => {
                      const formatted = formatExpiryDate(text);
                      setCardDetails({ ...cardDetails, expiryDate: formatted });
                      if (errors.expiryDate) {
                        setErrors({ ...errors, expiryDate: '' });
                      }
                    }}
                  />
                  {errors.expiryDate && (
                    <Text className="mt-1 text-xs text-error">{errors.expiryDate}</Text>
                  )}
                </View>

                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground mb-2">CVV *</Text>
                  <TextInput
                    className={`px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                      errors.cvv ? 'border-error' : 'border-border'
                    }`}
                    placeholder="123"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                    value={cardDetails.cvv}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '');
                      setCardDetails({ ...cardDetails, cvv: cleaned });
                      if (errors.cvv) {
                        setErrors({ ...errors, cvv: '' });
                      }
                    }}
                  />
                  {errors.cvv && (
                    <Text className="mt-1 text-xs text-error">{errors.cvv}</Text>
                  )}
                </View>
              </View>

              {/* Cardholder Name */}
              <View>
                <Text className="text-sm font-medium text-foreground mb-2">Cardholder Name *</Text>
                <TextInput
                  className={`px-4 py-3 rounded-2xl bg-surface border text-base text-foreground ${
                    errors.cardholderName ? 'border-error' : 'border-border'
                  }`}
                  placeholder="John Doe"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="words"
                  value={cardDetails.cardholderName}
                  onChangeText={(text) => {
                    setCardDetails({ ...cardDetails, cardholderName: text });
                    if (errors.cardholderName) {
                      setErrors({ ...errors, cardholderName: '' });
                    }
                  }}
                />
                {errors.cardholderName && (
                  <Text className="mt-1 text-xs text-error">{errors.cardholderName}</Text>
                )}
              </View>
            </View>
          )}

          {selectedMethod === 'bank_transfer' && (
            <View className="rounded-2xl bg-surface p-4 border border-border">
              <Text className="text-base font-semibold text-foreground mb-4">
                Bank Transfer Details
              </Text>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Bank Name</Text>
                  <Text className="text-sm font-semibold text-foreground">First Bank of Nigeria</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Account Number</Text>
                  <Text className="text-sm font-semibold text-foreground">1234567890</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Account Name</Text>
                  <Text className="text-sm font-semibold text-foreground">School Fees Platform</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Reference Code</Text>
                  <Text className="text-sm font-bold text-primary">{bankCode}</Text>
                </View>
              </View>
              <View className="mt-4 p-3 rounded-xl bg-warning/10">
                <Text className="text-xs text-warning">
                  ⚠️ Please include the reference code in your transfer description
                </Text>
              </View>
            </View>
          )}

          {selectedMethod === 'ussd' && (
            <View className="rounded-2xl bg-surface p-4 border border-border">
              <Text className="text-base font-semibold text-foreground mb-4">USSD Code</Text>
              <View className="items-center py-6">
                <Text className="text-sm text-muted mb-3">Dial this code on your phone:</Text>
                <View className="px-6 py-4 rounded-2xl bg-primary/10 border border-primary">
                  <Text className="text-2xl font-bold text-primary">{ussdCode}</Text>
                </View>
              </View>
              <View className="mt-4 p-3 rounded-xl bg-warning/10">
                <Text className="text-xs text-warning">
                  ⚠️ Make sure you have sufficient balance in your account
                </Text>
              </View>
            </View>
          )}

          {selectedMethod === 'wallet' && (
            <View className="rounded-2xl bg-surface p-4 border border-border">
              <Text className="text-base font-semibold text-foreground mb-4">Wallet Payment</Text>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Wallet Balance</Text>
                  <Text className="text-sm font-bold text-success">{formatCurrency(150000)}</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Payment Amount</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatCurrency(paymentAmount)}
                  </Text>
                </View>
                <View className="h-px bg-border" />
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-foreground">Balance After Payment</Text>
                  <Text className="text-base font-bold text-primary">
                    {formatCurrency(150000 - paymentAmount)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Security Notice */}
          <View className="mt-6 rounded-2xl bg-surface p-4 border border-border">
            <Text className="text-sm font-semibold text-foreground mb-2">🔒 Secure Payment</Text>
            <Text className="text-xs text-muted">
              Your payment information is encrypted and secure. We never store your card details.
            </Text>
          </View>
        </View>

        <View className="h-24" />
      </ScrollView>

      {/* Pay Button (Fixed at bottom) */}
      <View className="absolute bottom-0 left-0 right-0 px-4 py-4 bg-background border-t border-border">
        <TouchableOpacity
          onPress={handlePayment}
          disabled={processing}
          className={`rounded-2xl py-4 items-center ${
            processing ? 'bg-primary/50' : 'bg-primary'
          }`}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-base font-semibold text-background">
              Pay {formatCurrency(paymentAmount)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
