import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Image, TextInput, Alert, Modal } from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

interface KYCSubmissionDetail {
  id: number;
  user_id: number;
  document_type: string;
  document_number: string;
  full_name: string;
  date_of_birth: string;
  address: string;
  nationality: string;
  document_image_url: string;
  selfie_image_url: string;
  ocr_data: any;
  facial_recognition_data: any;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function KYCReviewScreen() {
  const { id } = useLocalSearchParams();
  const colors = useColors();
  const [submission, setSubmission] = useState<KYCSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchSubmissionDetails();
  }, [id]);

  const fetchSubmissionDetails = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/submission/${id}`);
      const data = await response.json();
      setSubmission(data.submission);
    } catch (error) {
      console.error('Failed to fetch submission details:', error);
      Alert.alert('Error', 'Failed to load submission details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Approve KYC',
      'Are you sure you want to approve this KYC submission?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setProcessing(true);
            try {
              const response = await fetch('http://127.0.0.1:5010/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  submission_id: parseInt(id as string),
                  reviewer_id: 1, // TODO: Get from auth context
                  notes: notes || undefined,
                }),
              });

              if (response.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'KYC approved successfully', [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              } else {
                throw new Error('Failed to approve KYC');
              }
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to approve KYC submission');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Reject KYC',
      'Are you sure you want to reject this KYC submission?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              const response = await fetch('http://127.0.0.1:5010/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  submission_id: parseInt(id as string),
                  reviewer_id: 1, // TODO: Get from auth context
                  reason: rejectionReason,
                  notes: notes || undefined,
                }),
              });

              if (response.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'KYC rejected successfully', [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              } else {
                throw new Error('Failed to reject KYC');
              }
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to reject KYC submission');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const openImageModal = (imageUrl: string) => {
    setModalImage(imageUrl);
    setShowImageModal(true);
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-foreground mt-4">Loading submission...</Text>
      </ScreenContainer>
    );
  }

  if (!submission) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-xl text-muted">Submission not found</Text>
      </ScreenContainer>
    );
  }

  const ocrData = submission.ocr_data ? JSON.parse(submission.ocr_data as any) : {};
  const faceData = submission.facial_recognition_data ? JSON.parse(submission.facial_recognition_data as any) : {};

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-4">
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-2">
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={28} color={colors.foreground} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">KYC Review</Text>
              <Text className="text-sm text-muted">Submission #{submission.id}</Text>
            </View>
          </View>

          {/* User Information */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">User Information</Text>
            <View className="gap-2">
              <InfoRow label="User ID" value={submission.user_id.toString()} />
              <InfoRow label="Full Name" value={submission.full_name || 'N/A'} />
              <InfoRow label="Document Number" value={submission.document_number || 'N/A'} />
              <InfoRow label="Date of Birth" value={submission.date_of_birth || 'N/A'} />
              <InfoRow label="Address" value={submission.address || 'N/A'} />
              <InfoRow label="Nationality" value={submission.nationality || 'N/A'} />
            </View>
          </View>

          {/* Document Images */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">Documents</Text>
            
            <View className="gap-3">
              <TouchableOpacity
                onPress={() => openImageModal(submission.document_image_url)}
                activeOpacity={0.8}
              >
                <Text className="text-sm font-medium text-muted mb-2">Document Photo</Text>
                <Image
                  source={{ uri: submission.document_image_url }}
                  className="w-full h-48 rounded-xl"
                  resizeMode="cover"
                />
                <Text className="text-xs text-primary text-center mt-2">Tap to enlarge</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openImageModal(submission.selfie_image_url)}
                activeOpacity={0.8}
              >
                <Text className="text-sm font-medium text-muted mb-2">Selfie Photo</Text>
                <Image
                  source={{ uri: submission.selfie_image_url }}
                  className="w-full h-48 rounded-xl"
                  resizeMode="cover"
                />
                <Text className="text-xs text-primary text-center mt-2">Tap to enlarge</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Verification Data */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">Verification Results</Text>
            <View className="gap-2">
              <InfoRow 
                label="OCR Confidence" 
                value={ocrData.confidence ? `${Math.round(ocrData.confidence * 100)}%` : 'N/A'} 
              />
              <InfoRow 
                label="Face Match Confidence" 
                value={faceData.confidence ? `${Math.round(faceData.confidence * 100)}%` : 'N/A'} 
              />
              <InfoRow 
                label="Liveness Check" 
                value={faceData.liveness ? (faceData.liveness.is_live ? 'Passed' : 'Failed') : 'N/A'} 
              />
            </View>
          </View>

          {/* Review Notes */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">Review Notes</Text>
            <TextInput
              className="bg-background border border-border rounded-xl p-3 text-foreground min-h-[100px]"
              placeholder="Add notes about this review..."
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Rejection Reason (shown when rejecting) */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">Rejection Reason</Text>
            <TextInput
              className="bg-background border border-border rounded-xl p-3 text-foreground min-h-[100px]"
              placeholder="Provide a clear reason for rejection..."
              placeholderTextColor={colors.muted}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              onPress={handleReject}
              disabled={processing}
              className="flex-1 bg-red-500 rounded-full py-4"
              style={{ opacity: processing ? 0.5 : 1 }}
              activeOpacity={0.8}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-center text-base">Reject</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApprove}
              disabled={processing}
              className="flex-1 bg-green-500 rounded-full py-4"
              style={{ opacity: processing ? 0.5 : 1 }}
              activeOpacity={0.8}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-center text-base">Approve</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Image Modal */}
      <Modal visible={showImageModal} transparent animationType="fade">
        <View className="flex-1 bg-black/90 items-center justify-center">
          <TouchableOpacity
            onPress={() => setShowImageModal(false)}
            className="absolute top-12 right-6 z-10"
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
          
          <Image
            source={{ uri: modalImage }}
            className="w-full h-full"
            resizeMode="contain"
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm text-muted">{label}:</Text>
      <Text className="text-sm font-medium text-foreground flex-1 text-right">{value}</Text>
    </View>
  );
}
