import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { router, useLocalSearchParams } from 'expo-router';

const LOSS_TYPES = [
  { value: 'drought', label: 'Drought', icon: '☀️' },
  { value: 'flood', label: 'Flood', icon: '🌊' },
  { value: 'pest', label: 'Pest/Disease', icon: '🐛' },
  { value: 'storm', label: 'Storm/Wind', icon: '🌪️' },
  { value: 'fire', label: 'Fire', icon: '🔥' },
  { value: 'other', label: 'Other', icon: '📋' },
];

export default function SubmitClaimScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const policyId = params.policyId as string;

  const [loading, setLoading] = useState(false);

  // Form data
  const [lossType, setLossType] = useState('');
  const [lossDate, setLossDate] = useState('');
  const [estimatedLossPercent, setEstimatedLossPercent] = useState('');
  const [description, setDescription] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);

  const [showLossTypeDropdown, setShowLossTypeDropdown] = useState(false);

  const handleAddPhoto = () => {
    // In production: Use expo-image-picker
    Alert.alert(
      'Add Photo',
      'In production, this would open the camera or photo library.',
      [
        {
          text: 'Camera',
          onPress: () => {
            // Simulate photo capture
            const photoUri = `photo_${Date.now()}.jpg`;
            setEvidencePhotos([...evidencePhotos, photoUri]);
            Alert.alert('Success', 'Photo added successfully');
          },
        },
        {
          text: 'Gallery',
          onPress: () => {
            // Simulate photo selection
            const photoUri = `photo_${Date.now()}.jpg`;
            setEvidencePhotos([...evidencePhotos, photoUri]);
            Alert.alert('Success', 'Photo added successfully');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = evidencePhotos.filter((_, i) => i !== index);
    setEvidencePhotos(newPhotos);
  };

  const handleSubmit = async () => {
    // Validation
    if (!lossType) {
      Alert.alert('Required', 'Please select loss type');
      return;
    }
    if (!lossDate) {
      Alert.alert('Required', 'Please enter loss date');
      return;
    }
    const lossPercent = parseFloat(estimatedLossPercent);
    if (!estimatedLossPercent || isNaN(lossPercent) || lossPercent <= 0 || lossPercent > 100) {
      Alert.alert('Invalid', 'Please enter estimated loss percentage (1-100)');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please provide a description of the loss');
      return;
    }
    if (evidencePhotos.length === 0) {
      Alert.alert('Required', 'Please add at least one photo as evidence');
      return;
    }

    try {
      setLoading(true);

      // In production: POST to API with file uploads
      const claimData = {
        policy_id: policyId,
        loss_type: lossType,
        loss_date: lossDate,
        estimated_loss_percent: parseFloat(estimatedLossPercent),
        description,
        evidence_photos: evidencePhotos,
      };

      await new Promise(resolve => setTimeout(resolve, 1500));

      Alert.alert(
        'Success',
        'Claim submitted successfully! We will review your claim and contact you within 3-5 business days.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit claim. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 py-6 bg-surface border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-primary text-base">← Back</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">Submit Claim</Text>
          <Text className="mt-2 text-base text-muted">
            Report crop loss and request insurance payout
          </Text>
        </View>

        <View className="px-4 py-6 gap-4">
          {/* Policy Info */}
          <View className="rounded-2xl bg-primary/10 p-4 border border-primary">
            <Text className="text-sm font-semibold text-foreground mb-1">Policy ID</Text>
            <Text className="text-base text-foreground">{policyId}</Text>
          </View>

          {/* Loss Information */}
          <View className="rounded-2xl bg-surface p-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">Loss Information</Text>

            <View className="gap-4">
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Loss Type *</Text>
                <TouchableOpacity
                  onPress={() => setShowLossTypeDropdown(!showLossTypeDropdown)}
                  className="rounded-xl px-4 py-3 bg-background border border-border"
                >
                  <Text className={lossType ? 'text-foreground' : 'text-muted'}>
                    {lossType
                      ? `${LOSS_TYPES.find(t => t.value === lossType)?.icon} ${LOSS_TYPES.find(t => t.value === lossType)?.label}`
                      : 'Select loss type'}
                  </Text>
                </TouchableOpacity>
                {showLossTypeDropdown && (
                  <View className="mt-2 rounded-xl bg-background border border-border">
                    {LOSS_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        onPress={() => {
                          setLossType(type.value);
                          setShowLossTypeDropdown(false);
                        }}
                        className="px-4 py-3 border-b border-border flex-row items-center"
                      >
                        <Text className="text-xl mr-3">{type.icon}</Text>
                        <Text className="text-foreground">{type.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Loss Date *</Text>
                <TextInput
                  value={lossDate}
                  onChangeText={setLossDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  className="rounded-xl px-4 py-3 bg-background border border-border text-foreground"
                />
                <Text className="text-xs text-muted mt-1">Date when the loss occurred</Text>
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Estimated Loss Percentage *
                </Text>
                <TextInput
                  value={estimatedLossPercent}
                  onChangeText={setEstimatedLossPercent}
                  placeholder="e.g., 25"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  className="rounded-xl px-4 py-3 bg-background border border-border text-foreground"
                />
                <Text className="text-xs text-muted mt-1">Percentage of crop affected (1-100)</Text>
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Description *</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe what happened and the extent of the damage..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  className="rounded-xl px-4 py-3 bg-background border border-border text-foreground"
                  style={{ minHeight: 100 }}
                />
                <Text className="text-xs text-muted mt-1">
                  Provide detailed information about the loss
                </Text>
              </View>
            </View>
          </View>

          {/* Evidence Photos */}
          <View className="rounded-2xl bg-surface p-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-2">Evidence Photos *</Text>
            <Text className="text-sm text-muted mb-4">
              Upload photos showing the damage to your crops
            </Text>

            {/* Photo Grid */}
            <View className="flex-row flex-wrap gap-3 mb-4">
              {evidencePhotos.map((photo, index) => (
                <View
                  key={index}
                  className="w-24 h-24 rounded-xl bg-background border border-border items-center justify-center"
                >
                  <Text className="text-3xl mb-1">📷</Text>
                  <Text className="text-xs text-muted">Photo {index + 1}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemovePhoto(index)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-error items-center justify-center"
                  >
                    <Text className="text-background text-xs font-bold">×</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add Photo Button */}
              {evidencePhotos.length < 5 && (
                <TouchableOpacity
                  onPress={handleAddPhoto}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-primary bg-primary/10 items-center justify-center"
                >
                  <Text className="text-3xl text-primary mb-1">+</Text>
                  <Text className="text-xs text-primary font-semibold">Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text className="text-xs text-muted">
              {evidencePhotos.length}/5 photos • At least 1 photo required
            </Text>
          </View>

          {/* Claim Process Info */}
          <View className="rounded-2xl bg-primary/10 p-4 border border-primary">
            <Text className="text-sm font-semibold text-foreground mb-3">📋 Claim Process</Text>
            <View className="gap-2">
              <View className="flex-row">
                <Text className="text-xs text-muted mr-2">1.</Text>
                <Text className="text-xs text-muted flex-1">
                  Submit your claim with photos and description
                </Text>
              </View>
              <View className="flex-row">
                <Text className="text-xs text-muted mr-2">2.</Text>
                <Text className="text-xs text-muted flex-1">
                  Our team will review your claim within 3-5 business days
                </Text>
              </View>
              <View className="flex-row">
                <Text className="text-xs text-muted mr-2">3.</Text>
                <Text className="text-xs text-muted flex-1">
                  If approved, payout will be processed within 7 business days
                </Text>
              </View>
              <View className="flex-row">
                <Text className="text-xs text-muted mr-2">4.</Text>
                <Text className="text-xs text-muted flex-1">
                  Deductible: 10% of loss amount applies
                </Text>
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className={`rounded-2xl py-4 items-center ${loading ? 'bg-surface' : 'bg-primary'}`}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-base font-semibold text-background">Submit Claim</Text>
            )}
          </TouchableOpacity>

          {/* Help Text */}
          <View className="rounded-xl bg-background p-4 border border-border">
            <Text className="text-xs font-semibold text-foreground mb-2">Need Help?</Text>
            <Text className="text-xs text-muted">
              If you have questions about the claims process, contact our support team at
              claims@agriinsure.ng or call +234 800 123 4567
            </Text>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
