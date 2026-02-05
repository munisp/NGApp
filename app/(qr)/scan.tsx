import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenContainer } from '@/components/screen-container';

export default function QRScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Not Available',
        'QR code scanning is only available on mobile devices.',
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
          QR code scanning is not available on web
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
        <Stack.Screen options={{ title: 'Scan QR Code', headerShown: true }} />
        
        <Text className="text-6xl mb-4">📷</Text>
        <Text className="text-foreground font-semibold text-lg mb-2">
          Camera Permission Required
        </Text>
        <Text className="text-muted text-center mb-6">
          We need access to your camera to scan QR codes
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

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);

    try {
      // Parse QR code data (expected format: fintech://pay?recipient=ID&amount=AMOUNT&note=NOTE)
      const url = new URL(data);
      
      if (url.protocol !== 'fintech:' || url.hostname !== 'pay') {
        Alert.alert('Invalid QR Code', 'This QR code is not a valid payment request', [
          {
            text: 'Scan Again',
            onPress: () => setScanned(false),
          },
          {
            text: 'Cancel',
            onPress: () => router.back(),
          },
        ]);
        return;
      }

      const recipient = url.searchParams.get('recipient');
      const amount = url.searchParams.get('amount');
      const note = url.searchParams.get('note');

      if (!recipient) {
        Alert.alert('Invalid QR Code', 'Recipient information is missing', [
          {
            text: 'Scan Again',
            onPress: () => setScanned(false),
          },
        ]);
        return;
      }

      // Navigate to payment confirmation
      router.push({
        pathname: '/(qr)/confirm' as any,
        params: {
          recipient,
          amount: amount || '0',
          note: note || '',
        },
      });
    } catch (error) {
      Alert.alert('Invalid QR Code', 'Could not parse QR code data', [
        {
          text: 'Scan Again',
          onPress: () => setScanned(false),
        },
        {
          text: 'Cancel',
          onPress: () => router.back(),
        },
      ]);
    }
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: 'Scan QR Code', headerShown: true }} />

      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        {/* Overlay */}
        <View className="flex-1 justify-center items-center">
          {/* Top Dark Overlay */}
          <View className="absolute top-0 left-0 right-0 h-1/4 bg-black/70" />
          
          {/* Bottom Dark Overlay */}
          <View className="absolute bottom-0 left-0 right-0 h-1/4 bg-black/70" />
          
          {/* Left Dark Overlay */}
          <View className="absolute top-1/4 bottom-1/4 left-0 w-12 bg-black/70" />
          
          {/* Right Dark Overlay */}
          <View className="absolute top-1/4 bottom-1/4 right-0 w-12 bg-black/70" />

          {/* QR Frame */}
          <View className="w-64 h-64 border-4 border-white rounded-2xl">
            <View className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
            <View className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
            <View className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
            <View className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-2xl" />
          </View>

          {/* Instructions */}
          <View className="absolute bottom-32 left-0 right-0 items-center">
            <View className="bg-black/80 rounded-2xl px-6 py-4 mx-4">
              <Text className="text-white text-center font-semibold text-lg mb-2">
                {scanned ? 'Processing...' : 'Position QR code within the frame'}
              </Text>
              <Text className="text-white/80 text-center text-sm">
                {scanned ? 'Please wait' : 'The code will be scanned automatically'}
              </Text>
            </View>
          </View>

          {/* Cancel Button */}
          <View className="absolute bottom-8 left-0 right-0 px-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-surface/90 rounded-xl py-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground text-center font-semibold text-lg">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}
