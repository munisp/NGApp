import { ScrollView, Text, View, TouchableOpacity, Image, Alert } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { kycService } from "@/lib/api/kyc-service";

interface RejectedSubmission {
  id: number;
  status: string;
  rejection_reason: string;
  review_notes: string;
  document_type: string;
  created_at: string;
}

export default function KYCResubmitScreen() {
  const colors = useColors();
  const [submission, setSubmission] = useState<RejectedSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [documentImage, setDocumentImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRejectedSubmission();
  }, []);

  const fetchRejectedSubmission = async () => {
    try {
      const status = await kycService.getKYCStatus();
      if (status && status.status === 'rejected') {
        setSubmission({
          id: 0,
          status: 'rejected',
          rejection_reason: status.rejectionReason || 'Documents were not clear enough',
          review_notes: '',
          document_type: 'national_id',
          created_at: status.submittedAt,
        });
      }
    } catch (error) {
      console.error('Failed to fetch rejected submission:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (type: 'document' | 'selfie') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'document' ? [4, 3] : [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === 'document') {
        setDocumentImage(base64Image);
      } else {
        setSelfieImage(base64Image);
      }
    }
  };

  const takePhoto = async (type: 'document' | 'selfie') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: type === 'document' ? [4, 3] : [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === 'document') {
        setDocumentImage(base64Image);
      } else {
        setSelfieImage(base64Image);
      }
    }
  };

  const handleResubmit = async () => {
    if (!documentImage || !selfieImage) {
      Alert.alert('Error', 'Please upload both document and selfie photos');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);

    try {
      await kycService.submitKYC({
        documentType: (submission?.document_type as 'passport' | 'drivers_license' | 'national_id' | 'voters_card') || 'national_id',
        frontImage: documentImage,
        backImage: null,
        selfieImage: selfieImage,
        fullName: '',
        documentNumber: '',
        dateOfBirth: '',
        address: '',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success',
        'Your KYC documents have been resubmitted for review',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to resubmit KYC documents. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">Loading...</Text>
      </ScreenContainer>
    );
  }

  if (!submission) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-xl text-muted text-center">No rejected KYC submission found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-primary px-6 py-3 rounded-full"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-4">
          {/* Header */}
          <View className="mb-2">
            <Text className="text-3xl font-bold text-foreground">Resubmit KYC</Text>
            <Text className="text-base text-muted mt-1">
              Your previous submission was rejected. Please review the feedback and resubmit.
            </Text>
          </View>

          {/* Rejection Reason */}
          <View className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-200 dark:border-red-800">
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="alert-circle" size={24} color="#EF4444" />
              <Text className="text-lg font-semibold text-red-600 dark:text-red-400">
                Rejection Reason
              </Text>
            </View>
            <Text className="text-sm text-red-700 dark:text-red-300">
              {submission.rejection_reason || 'No reason provided'}
            </Text>
            {submission.review_notes && (
              <Text className="text-sm text-red-600 dark:text-red-400 mt-2">
                Note: {submission.review_notes}
              </Text>
            )}
          </View>

          {/* Photo Quality Tips */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">
              📸 Photo Quality Tips
            </Text>
            <View className="gap-2">
              <TipRow icon="checkmark-circle" text="Use good lighting (natural light works best)" />
              <TipRow icon="checkmark-circle" text="Ensure the document is in focus and readable" />
              <TipRow icon="checkmark-circle" text="Avoid glare and shadows on the document" />
              <TipRow icon="checkmark-circle" text="Capture the entire document (no cropped edges)" />
              <TipRow icon="checkmark-circle" text="Take selfie in good lighting with neutral background" />
              <TipRow icon="checkmark-circle" text="Face the camera directly and remove glasses" />
            </View>
          </View>

          {/* Document Photo */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Document Photo
            </Text>
            
            {documentImage ? (
              <View>
                <Image
                  source={{ uri: documentImage }}
                  className="w-full h-48 rounded-xl mb-3"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => setDocumentImage(null)}
                  className="bg-red-500 py-2 rounded-full"
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold text-center">Remove Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="gap-3">
                <TouchableOpacity
                  onPress={() => takePhoto('document')}
                  className="bg-primary py-3 rounded-full flex-row items-center justify-center gap-2"
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text className="text-white font-semibold">Take Photo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => pickImage('document')}
                  className="bg-surface border border-border py-3 rounded-full flex-row items-center justify-center gap-2"
                  activeOpacity={0.8}
                >
                  <Ionicons name="images" size={20} color={colors.foreground} />
                  <Text className="text-foreground font-semibold">Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Selfie Photo */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Selfie Photo
            </Text>
            
            {selfieImage ? (
              <View>
                <Image
                  source={{ uri: selfieImage }}
                  className="w-full h-48 rounded-xl mb-3"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => setSelfieImage(null)}
                  className="bg-red-500 py-2 rounded-full"
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold text-center">Remove Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="gap-3">
                <TouchableOpacity
                  onPress={() => takePhoto('selfie')}
                  className="bg-primary py-3 rounded-full flex-row items-center justify-center gap-2"
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text className="text-white font-semibold">Take Selfie</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => pickImage('selfie')}
                  className="bg-surface border border-border py-3 rounded-full flex-row items-center justify-center gap-2"
                  activeOpacity={0.8}
                >
                  <Ionicons name="images" size={20} color={colors.foreground} />
                  <Text className="text-foreground font-semibold">Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleResubmit}
            disabled={!documentImage || !selfieImage || submitting}
            className="bg-primary py-4 rounded-full mb-6"
            style={{ opacity: (!documentImage || !selfieImage || submitting) ? 0.5 : 1 }}
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold text-center text-lg">
              {submitting ? 'Submitting...' : 'Resubmit KYC'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function TipRow({ icon, text }: { icon: string; text: string }) {
  const colors = useColors();
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons name={icon as any} size={18} color="#22C55E" style={{ marginTop: 2 }} />
      <Text className="text-sm text-muted flex-1">{text}</Text>
    </View>
  );
}
