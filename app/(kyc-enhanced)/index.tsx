import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { kycService } from '@/lib/api/kyc-service';

type DocumentType = 'passport' | 'drivers_license' | 'national_id' | 'voters_card';
type KYCStep = 'document_type' | 'document_upload' | 'selfie' | 'review' | 'complete';
type KYCStatus = 'pending' | 'in_review' | 'verified' | 'rejected';

interface KYCData {
  documentType: DocumentType;
  frontImage: string | null;
  backImage: string | null;
  selfieImage: string | null;
  fullName: string;
  documentNumber: string;
  dateOfBirth: string;
  address: string;
}

export default function KYCEnhancedScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [currentStep, setCurrentStep] = useState<KYCStep>('document_type');
  const [kycData, setKYCData] = useState<KYCData>({
    documentType: 'national_id',
    frontImage: null,
    backImage: null,
    selfieImage: null,
    fullName: '',
    documentNumber: '',
    dateOfBirth: '',
    address: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    setHasBiometricHardware(compatible);
  };

  const pickImage = async (imageType: 'front' | 'back' | 'selfie') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: imageType === 'selfie' ? [1, 1] : [4, 3],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      setKYCData(prev => ({
        ...prev,
        [`${imageType}Image`]: result.assets[0].uri,
      }));
    }
  };

  const takePhoto = async (imageType: 'front' | 'back' | 'selfie') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: imageType === 'selfie' ? [1, 1] : [4, 3],
      quality: 0.9,
      cameraType: imageType === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });

    if (!result.canceled && result.assets[0]) {
      setKYCData(prev => ({
        ...prev,
        [`${imageType}Image`]: result.assets[0].uri,
      }));
    }
  };

  const captureFacialRecognition = async () => {
    if (hasBiometricHardware) {
      const { success } = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity',
        fallbackLabel: 'Use passcode',
      });

      if (!success) {
        Alert.alert('Verification Failed', 'Please try again');
        return;
      }
    }

    // Capture selfie for facial recognition
    await takePhoto('selfie');
  };

  const handleSubmit = async () => {
    if (!kycData.frontImage) {
      Alert.alert('Error', 'Please upload the front of your document');
      return;
    }

    if (kycData.documentType !== 'passport' && !kycData.backImage) {
      Alert.alert('Error', 'Please upload the back of your document');
      return;
    }

    if (!kycData.selfieImage) {
      Alert.alert('Error', 'Please take a selfie for facial verification');
      return;
    }

    try {
      setIsUploading(true);

      // Upload KYC documents and selfie
      const result = await kycService.submitKYC({
        documentType: kycData.documentType,
        frontImage: kycData.frontImage,
        backImage: kycData.backImage,
        selfieImage: kycData.selfieImage,
        fullName: kycData.fullName,
        documentNumber: kycData.documentNumber,
        dateOfBirth: kycData.dateOfBirth,
        address: kycData.address,
      });

      await refreshUser();

      setCurrentStep('complete');

      Alert.alert(
        'Success',
        'Your documents have been submitted for verification. We\'ll notify you within 24-48 hours.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit KYC documents');
    } finally {
      setIsUploading(false);
    }
  };

  const documentTypes: { value: DocumentType; label: string; emoji: string; description: string }[] = [
    { value: 'national_id', label: 'National ID', emoji: '🆔', description: 'Government-issued ID card' },
    { value: 'passport', label: 'Passport', emoji: '🛂', description: 'International passport' },
    { value: 'drivers_license', label: 'Driver\'s License', emoji: '🪪', description: 'Valid driver\'s license' },
    { value: 'voters_card', label: 'Voter\'s Card', emoji: '🗳️', description: 'Voter registration card' },
  ];

  const renderDocumentTypeStep = () => (
    <View>
      <Text className="text-2xl font-bold text-foreground mb-2">Select Document Type</Text>
      <Text className="text-muted mb-6">
        Choose the type of government-issued ID you want to upload
      </Text>

      <View className="gap-3">
        {documentTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            onPress={() => setKYCData(prev => ({ ...prev, documentType: type.value }))}
            className={`p-4 rounded-xl border flex-row items-center ${
              kycData.documentType === type.value
                ? 'bg-primary/10 border-primary'
                : 'bg-surface border-border'
            }`}
            style={{ opacity: 1 }}
          >
            <Text className="text-4xl mr-4">{type.emoji}</Text>
            <View className="flex-1">
              <Text
                className={`text-lg font-semibold ${
                  kycData.documentType === type.value ? 'text-primary' : 'text-foreground'
                }`}
              >
                {type.label}
              </Text>
              <Text className="text-sm text-muted">{type.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => setCurrentStep('document_upload')}
        className="bg-primary rounded-xl p-4 mt-6"
        style={{ opacity: 1 }}
      >
        <Text className="text-white text-center font-semibold text-lg">Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDocumentUploadStep = () => (
    <View>
      <Text className="text-2xl font-bold text-foreground mb-2">Upload Document</Text>
      <Text className="text-muted mb-6">
        Take clear photos of both sides of your {documentTypes.find(t => t.value === kycData.documentType)?.label}
      </Text>

      {/* Front Image Upload */}
      <Text className="text-lg font-semibold text-foreground mb-3">Front of Document</Text>
      <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
        {kycData.frontImage ? (
          <View>
            <Image source={{ uri: kycData.frontImage }} className="w-full h-48 rounded-lg mb-3" resizeMode="cover" />
            <TouchableOpacity
              onPress={() => setKYCData(prev => ({ ...prev, frontImage: null }))}
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
      {kycData.documentType !== 'passport' && (
        <>
          <Text className="text-lg font-semibold text-foreground mb-3">Back of Document</Text>
          <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
            {kycData.backImage ? (
              <View>
                <Image source={{ uri: kycData.backImage }} className="w-full h-48 rounded-lg mb-3" resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => setKYCData(prev => ({ ...prev, backImage: null }))}
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

      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => setCurrentStep('document_type')}
          className="flex-1 bg-surface border border-border rounded-xl p-4"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold">Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCurrentStep('selfie')}
          disabled={!kycData.frontImage || (kycData.documentType !== 'passport' && !kycData.backImage)}
          className={`flex-1 rounded-xl p-4 ${
            !kycData.frontImage || (kycData.documentType !== 'passport' && !kycData.backImage)
              ? 'bg-primary/50'
              : 'bg-primary'
          }`}
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold">Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSelfieStep = () => (
    <View>
      <Text className="text-2xl font-bold text-foreground mb-2">Facial Verification</Text>
      <Text className="text-muted mb-6">
        Take a selfie to verify your identity. Make sure your face is clearly visible and matches your ID photo.
      </Text>

      <View className="bg-surface rounded-xl p-6 mb-6 border border-border items-center">
        {kycData.selfieImage ? (
          <View className="w-full">
            <Image source={{ uri: kycData.selfieImage }} className="w-full h-80 rounded-lg mb-4" resizeMode="cover" />
            <TouchableOpacity
              onPress={() => setKYCData(prev => ({ ...prev, selfieImage: null }))}
              className="bg-error/20 rounded-lg p-3"
              style={{ opacity: 1 }}
            >
              <Text className="text-error text-center font-medium">Retake Selfie</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="w-full gap-3">
            <View className="items-center mb-4">
              <Text className="text-6xl mb-3">🤳</Text>
              <Text className="text-foreground text-center font-medium">
                Position your face in the frame
              </Text>
              <Text className="text-muted text-center text-sm mt-2">
                • Remove glasses and hat{'\n'}
                • Ensure good lighting{'\n'}
                • Look directly at camera
              </Text>
            </View>
            
            <TouchableOpacity
              onPress={captureFacialRecognition}
              className="bg-primary rounded-lg p-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-white text-center font-semibold">📷 Take Selfie</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => pickImage('selfie')}
              className="bg-surface border border-border rounded-lg p-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground text-center font-semibold">📁 Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => setCurrentStep('document_upload')}
          className="flex-1 bg-surface border border-border rounded-xl p-4"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold">Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCurrentStep('review')}
          disabled={!kycData.selfieImage}
          className={`flex-1 rounded-xl p-4 ${!kycData.selfieImage ? 'bg-primary/50' : 'bg-primary'}`}
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold">Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReviewStep = () => (
    <View>
      <Text className="text-2xl font-bold text-foreground mb-2">Review & Submit</Text>
      <Text className="text-muted mb-6">
        Please review your information before submitting
      </Text>

      <View className="gap-4 mb-6">
        {/* Document Type */}
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-sm text-muted mb-1">Document Type</Text>
          <Text className="text-lg font-semibold text-foreground">
            {documentTypes.find(t => t.value === kycData.documentType)?.label}
          </Text>
        </View>

        {/* Document Images */}
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-sm text-muted mb-3">Document Images</Text>
          <View className="flex-row gap-3">
            {kycData.frontImage && (
              <Image source={{ uri: kycData.frontImage }} className="flex-1 h-32 rounded-lg" resizeMode="cover" />
            )}
            {kycData.backImage && (
              <Image source={{ uri: kycData.backImage }} className="flex-1 h-32 rounded-lg" resizeMode="cover" />
            )}
          </View>
        </View>

        {/* Selfie */}
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-sm text-muted mb-3">Facial Verification</Text>
          {kycData.selfieImage && (
            <Image source={{ uri: kycData.selfieImage }} className="w-32 h-32 rounded-full self-center" resizeMode="cover" />
          )}
        </View>
      </View>

      <View className="bg-warning/10 rounded-xl p-4 mb-6 border border-warning">
        <Text className="text-warning font-semibold mb-2">⚠️ Important</Text>
        <Text className="text-foreground text-sm">
          • Verification typically takes 24-48 hours{'\n'}
          • Ensure all images are clear and readable{'\n'}
          • You'll receive a notification once verified{'\n'}
          • Rejected submissions can be resubmitted
        </Text>
      </View>

      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => setCurrentStep('selfie')}
          className="flex-1 bg-surface border border-border rounded-xl p-4"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold">Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isUploading}
          className={`flex-1 rounded-xl p-4 ${isUploading ? 'bg-primary/50' : 'bg-primary'}`}
          style={{ opacity: 1 }}
        >
          {isUploading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white text-center font-semibold">Submit</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderProgressIndicator = () => {
    const steps = ['document_type', 'document_upload', 'selfie', 'review'];
    const currentIndex = steps.indexOf(currentStep);

    return (
      <View className="flex-row items-center justify-between mb-6">
        {steps.map((step, index) => (
          <View key={step} className="flex-row items-center flex-1">
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                index <= currentIndex ? 'bg-primary' : 'bg-surface border border-border'
              }`}
            >
              <Text className={`font-semibold ${index <= currentIndex ? 'text-white' : 'text-muted'}`}>
                {index + 1}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View className={`flex-1 h-1 mx-2 ${index < currentIndex ? 'bg-primary' : 'bg-border'}`} />
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'KYC Verification', headerBackTitle: 'Back' }} />
      
      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {currentStep !== 'complete' && renderProgressIndicator()}

        {currentStep === 'document_type' && renderDocumentTypeStep()}
        {currentStep === 'document_upload' && renderDocumentUploadStep()}
        {currentStep === 'selfie' && renderSelfieStep()}
        {currentStep === 'review' && renderReviewStep()}
      </ScrollView>
    </ScreenContainer>
  );
}
