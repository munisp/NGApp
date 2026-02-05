import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { userService } from '@/lib/api/services-mock';

type DocumentType = 'passport' | 'drivers_license' | 'national_id';

export default function KYCScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, refreshUser } = useAuth();
  const [documentType, setDocumentType] = useState<DocumentType>('passport');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [livenessVerified, setLivenessVerified] = useState(params.livenessVerified === 'true');

  const pickImage = async (side: 'front' | 'back') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (side === 'front') {
        setFrontImage(result.assets[0].uri);
      } else {
        setBackImage(result.assets[0].uri);
      }
    }
  };

  const takePhoto = async (side: 'front' | 'back') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (side === 'front') {
        setFrontImage(result.assets[0].uri);
      } else {
        setBackImage(result.assets[0].uri);
      }
    }
  };

  const handleSubmit = async () => {
    if (!frontImage) {
      Alert.alert('Error', 'Please upload the front of your document');
      return;
    }

    if (documentType !== 'passport' && !backImage) {
      Alert.alert('Error', 'Please upload the back of your document');
      return;
    }

    try {
      setIsUploading(true);

      // In a real app, you would upload the images to a server
      // For now, we'll just simulate the upload
      await userService.uploadKYC({
        document_type: documentType,
        front_image: frontImage,
        back_image: backImage || undefined,
      });

      await refreshUser();

      Alert.alert(
        'Success',
        'Your documents have been submitted for verification. We\'ll notify you once the review is complete.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload documents');
    } finally {
      setIsUploading(false);
    }
  };

  const documentTypes: { value: DocumentType; label: string; emoji: string }[] = [
    { value: 'passport', label: 'Passport', emoji: '🛂' },
    { value: 'drivers_license', label: 'Driver\'s License', emoji: '🪪' },
    { value: 'national_id', label: 'National ID', emoji: '🆔' },
  ];

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'KYC Verification' }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-foreground mb-2">Verify Your Identity</Text>
        <Text className="text-muted mb-6">
          Complete video liveness check and upload a valid government-issued ID
        </Text>

        {/* Video Liveness Step */}
        <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl">📹</Text>
              <Text className="text-lg font-semibold text-foreground">Video Liveness Check</Text>
            </View>
            {livenessVerified && (
              <View className="bg-success/20 rounded-full px-3 py-1">
                <Text className="text-success font-semibold text-sm">✓ Verified</Text>
              </View>
            )}
          </View>
          <Text className="text-muted mb-3">
            Verify you are a real person by completing random video challenges
          </Text>
          {!livenessVerified ? (
            <TouchableOpacity
              onPress={() => router.push('/(profile)/kyc-video-liveness')}
              className="bg-primary rounded-lg p-3"
              style={{ opacity: 1 }}
            >
              <Text className="text-white text-center font-semibold">Start Video Verification</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/(profile)/kyc-video-liveness')}
              className="bg-surface border border-border rounded-lg p-3"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground text-center font-semibold">Redo Video Verification</Text>
            </TouchableOpacity>
          )}
        </View>

      {/* Document Type Selection */}
      <Text className="text-lg font-semibold text-foreground mb-3">Select Document Type</Text>
      <View className="flex-row gap-3 mb-6">
        {documentTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            onPress={() => setDocumentType(type.value)}
            className={`flex-1 p-4 rounded-xl border ${
              documentType === type.value
                ? 'bg-primary/10 border-primary'
                : 'bg-surface border-border'
            }`}
            style={{ opacity: 1 }}
          >
            <Text className="text-3xl text-center mb-2">{type.emoji}</Text>
            <Text
              className={`text-sm text-center font-medium ${
                documentType === type.value ? 'text-primary' : 'text-foreground'
              }`}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Front Image Upload */}
      <Text className="text-lg font-semibold text-foreground mb-3">Front of Document</Text>
      <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
        {frontImage ? (
          <View>
            <Image source={{ uri: frontImage }} className="w-full h-48 rounded-lg mb-3" />
            <TouchableOpacity
              onPress={() => setFrontImage(null)}
              className="bg-error/20 rounded-lg p-2"
              style={{ opacity: 1 }}
            >
              <Text className="text-error text-center font-medium">Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-2">
            <TouchableOpacity
              onPress={() => takePhoto('front')}
              className="bg-primary rounded-lg p-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-white text-center font-semibold">📷 Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => pickImage('front')}
              className="bg-surface border border-border rounded-lg p-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground text-center font-semibold">📁 Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Back Image Upload (if not passport) */}
      {documentType !== 'passport' && (
        <>
          <Text className="text-lg font-semibold text-foreground mb-3">Back of Document</Text>
          <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
            {backImage ? (
              <View>
                <Image source={{ uri: backImage }} className="w-full h-48 rounded-lg mb-3" />
                <TouchableOpacity
                  onPress={() => setBackImage(null)}
                  className="bg-error/20 rounded-lg p-2"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-error text-center font-medium">Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="gap-2">
                <TouchableOpacity
                  onPress={() => takePhoto('back')}
                  className="bg-primary rounded-lg p-4"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-white text-center font-semibold">📷 Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => pickImage('back')}
                  className="bg-surface border border-border rounded-lg p-4"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-foreground text-center font-semibold">📁 Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isUploading || !livenessVerified}
          className={`rounded-xl p-4 mb-6 ${isUploading || !livenessVerified ? 'bg-primary/50' : 'bg-primary'}`}
          style={{ opacity: 1 }}
        >
          {isUploading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white text-center font-semibold text-lg">
              {!livenessVerified ? 'Complete Video Liveness First' : 'Submit for Verification'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
