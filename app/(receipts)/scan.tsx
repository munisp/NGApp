import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';

interface ReceiptData {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  suggested_category?: string;
  category_confidence?: number;
  items: string[];
  confidence: number;
  ocrMethod: string;
}

export default function ScanReceiptScreen() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to scan receipts');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        if (result.assets[0].base64) {
          await scanReceipt(result.assets[0].base64);
        }
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera access to scan receipts');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        if (result.assets[0].base64) {
          await scanReceipt(result.assets[0].base64);
        }
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const scanReceipt = async (base64Image: string) => {
    setIsScanning(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // First, scan the receipt with OCR
      const ocrResponse = await axios.post(
        `${API_URL}/api/ocr/scan-receipt`,
        { imageBase64: base64Image },
        { timeout: 30000 }
      );

      const ocrData = ocrResponse.data;

      // Then, get auto-categorization suggestion
      try {
        const categorizationResponse = await axios.post(
          `${API_URL}/api/categorization/suggest`,
          {
            description: `${ocrData.merchant} ${ocrData.items.join(' ')}`,
            merchant: ocrData.merchant,
            amount: ocrData.amount,
          },
          { timeout: 5000 }
        );

        // Merge OCR data with categorization suggestion
        setReceiptData({
          ...ocrData,
          suggested_category: categorizationResponse.data.category,
          category_confidence: categorizationResponse.data.confidence,
        });
      } catch (catError) {
        console.error('Failed to get category suggestion:', catError);
        // Use OCR data without categorization
        setReceiptData(ocrData);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to scan receipt:', error);
      Alert.alert('Error', 'Failed to scan receipt. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsScanning(false);
    }
  };

  const saveTransaction = async () => {
    if (!receiptData) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // In a real app, save to backend
      Alert.alert(
        'Transaction Saved',
        `Saved ${receiptData.category} transaction for $${receiptData.amount.toFixed(2)} at ${receiptData.merchant}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save transaction:', error);
      Alert.alert('Error', 'Failed to save transaction');
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Scan Receipt', headerShown: true }} />

      <View className="flex-1">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-2xl mb-2">Scan Receipt</Text>
          <Text className="text-muted">
            Take a photo or select an image to automatically extract transaction details
          </Text>
        </View>

        {/* Image Preview */}
        {imageUri && (
          <View className="mb-6">
            <Image
              source={{ uri: imageUri }}
              className="w-full h-64 rounded-xl"
              resizeMode="contain"
            />
          </View>
        )}

        {/* Scanning Indicator */}
        {isScanning && (
          <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
            <ActivityIndicator size="large" color="#0a7ea4" />
            <Text className="text-foreground text-center mt-4 font-semibold">
              Scanning receipt...
            </Text>
            <Text className="text-muted text-center mt-2">
              Using multi-OCR technology to extract details
            </Text>
          </View>
        )}

        {/* Receipt Data */}
        {receiptData && !isScanning && (
          <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
            <Text className="text-foreground font-bold text-lg mb-4">Extracted Details</Text>
            
            <View className="gap-4">
              <View>
                <Text className="text-muted text-sm mb-1">Merchant</Text>
                <Text className="text-foreground font-semibold text-lg">
                  {receiptData.merchant}
                </Text>
              </View>

              <View>
                <Text className="text-muted text-sm mb-1">Amount</Text>
                <Text className="text-foreground font-bold text-2xl">
                  ${receiptData.amount.toFixed(2)}
                </Text>
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-muted text-sm mb-1">Date</Text>
                  <Text className="text-foreground font-semibold">
                    {new Date(receiptData.date).toLocaleDateString()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-muted text-sm mb-1">Category</Text>
                  <View className="bg-primary/20 px-3 py-1 rounded-full self-start">
                    <Text className="text-primary font-semibold">{receiptData.category}</Text>
                  </View>
                </View>
              </View>

              {receiptData.suggested_category && receiptData.suggested_category !== receiptData.category && (
                <View className="bg-success/10 rounded-lg p-3 border border-success/30">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-lg">💡</Text>
                    <Text className="text-foreground font-semibold">Suggested Category</Text>
                  </View>
                  <Text className="text-muted text-sm mb-2">
                    Based on merchant and items, we suggest:
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <View className="bg-success/20 px-3 py-1 rounded-full">
                      <Text className="text-success font-semibold">
                        {receiptData.suggested_category}
                      </Text>
                    </View>
                    {receiptData.category_confidence && (
                      <Text className="text-success text-xs font-semibold">
                        {(receiptData.category_confidence * 100).toFixed(0)}% confidence
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {receiptData.items.length > 0 && (
                <View>
                  <Text className="text-muted text-sm mb-2">Items</Text>
                  <View className="gap-1">
                    {receiptData.items.slice(0, 5).map((item, index) => (
                      <Text key={index} className="text-foreground">
                        • {item}
                      </Text>
                    ))}
                    {receiptData.items.length > 5 && (
                      <Text className="text-muted text-sm">
                        +{receiptData.items.length - 5} more items
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <View className="flex-row items-center gap-2">
                <View className="bg-success/20 px-3 py-1 rounded-full">
                  <Text className="text-success text-xs font-semibold">
                    {(receiptData.confidence * 100).toFixed(0)}% Confidence
                  </Text>
                </View>
                <View className="bg-muted/20 px-3 py-1 rounded-full">
                  <Text className="text-muted text-xs font-semibold uppercase">
                    {receiptData.ocrMethod}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={() => {
                  setImageUri(null);
                  setReceiptData(null);
                }}
                className="flex-1 bg-surface border border-border rounded-lg p-3"
                style={{ opacity: 1 }}
              >
                <Text className="text-foreground text-center font-semibold">Rescan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveTransaction}
                className="flex-1 bg-primary rounded-lg p-3"
                style={{ opacity: 1 }}
              >
                <Text className="text-white text-center font-semibold">Save Transaction</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Scan Options */}
        {!imageUri && !isScanning && (
          <View className="flex-1 justify-center gap-4">
            <TouchableOpacity
              onPress={takePhoto}
              className="bg-primary rounded-xl p-6"
              style={{ opacity: 1 }}
            >
              <View className="items-center">
                <Text className="text-6xl mb-3">📷</Text>
                <Text className="text-white font-bold text-xl mb-2">Take Photo</Text>
                <Text className="text-white/80 text-center">
                  Use your camera to scan a receipt
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={pickImage}
              className="bg-surface border border-border rounded-xl p-6"
              style={{ opacity: 1 }}
            >
              <View className="items-center">
                <Text className="text-6xl mb-3">🖼️</Text>
                <Text className="text-foreground font-bold text-xl mb-2">Choose from Gallery</Text>
                <Text className="text-muted text-center">
                  Select an existing receipt image
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Info */}
        <View className="bg-primary/5 rounded-xl p-4 border border-primary/20">
          <Text className="text-muted text-sm leading-relaxed">
            💡 For best results, ensure the receipt is well-lit, flat, and all text is clearly visible.
            The OCR system will automatically extract merchant, amount, date, and categorize the expense.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
