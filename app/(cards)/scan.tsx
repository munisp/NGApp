import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenContainer } from '@/components/screen-container';

export default function ScanCardScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Not Available',
        'Card scanning is only available on mobile devices. Please use the manual entry option.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    }
  }, []);

  if (Platform.OS === 'web') {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-foreground text-center">
          Card scanning is not available on web
        </Text>
      </ScreenContainer>
    );
  }

  if (!permission) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-foreground">Requesting camera permission...</Text>
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Stack.Screen options={{ title: 'Scan Card', headerShown: true }} />
        
        <Text className="text-6xl mb-4">📷</Text>
        <Text className="text-foreground font-semibold text-lg mb-2">
          Camera Permission Required
        </Text>
        <Text className="text-muted text-center mb-6">
          We need access to your camera to scan your card
        </Text>
        
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-primary rounded-xl px-6 py-3 mb-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface border border-border rounded-xl px-6 py-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const handleScanComplete = (cardNumber: string) => {
    setIsScanning(false);
    Alert.alert(
      'Card Detected',
      `Card number: ${cardNumber}\n\nNote: This is a demo. In production, use a proper OCR library like ML Kit or Tesseract.`,
      [
        {
          text: 'Manual Entry',
          onPress: () => router.push('/(cards)/add'),
        },
        {
          text: 'Scan Again',
          onPress: () => setIsScanning(true),
        },
      ]
    );
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: 'Scan Card', headerShown: true }} />

      <CameraView
        style={{ flex: 1 }}
        facing="back"
      >
        {/* Overlay */}
        <View className="flex-1 justify-center items-center">
          {/* Top Dark Overlay */}
          <View className="absolute top-0 left-0 right-0 h-1/4 bg-black/70" />
          
          {/* Bottom Dark Overlay */}
          <View className="absolute bottom-0 left-0 right-0 h-1/4 bg-black/70" />
          
          {/* Left Dark Overlay */}
          <View className="absolute top-1/4 bottom-1/4 left-0 w-8 bg-black/70" />
          
          {/* Right Dark Overlay */}
          <View className="absolute top-1/4 bottom-1/4 right-0 w-8 bg-black/70" />

          {/* Card Frame */}
          <View className="w-4/5 aspect-[1.586] border-4 border-white rounded-2xl">
            <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
            <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
            <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
            <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl" />
          </View>

          {/* Instructions */}
          <View className="absolute bottom-32 left-0 right-0 items-center">
            <View className="bg-black/80 rounded-2xl px-6 py-4 mx-4">
              <Text className="text-white text-center font-semibold text-lg mb-2">
                Position your card within the frame
              </Text>
              <Text className="text-white/80 text-center text-sm">
                Make sure all card details are visible and well-lit
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="absolute bottom-8 left-0 right-0 px-4 flex-row gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="flex-1 bg-surface/90 rounded-xl py-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground text-center font-semibold">
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                // Demo: Simulate card detection
                setTimeout(() => {
                  handleScanComplete('4532 1234 5678 9010');
                }, 1000);
              }}
              disabled={isScanning}
              className="flex-1 bg-primary rounded-xl py-4"
              style={{ opacity: isScanning ? 0.6 : 1 }}
            >
              <Text className="text-white text-center font-semibold">
                {isScanning ? 'Scanning...' : 'Capture'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}
