import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { kybService, type BusinessRegistrationData, type BeneficialOwner as APIBeneficialOwner, type Director as APIDirector, type DocumentUpload } from '@/lib/api/kyb-service';

type VerificationStep = 'intro' | 'business-info' | 'business-documents' | 'beneficial-owners' | 'directors' | 'review' | 'complete';
type BusinessType = 'sole_proprietor' | 'partnership' | 'limited_company' | 'corporation';

interface BusinessInfo {
  businessName: string;
  registrationNumber: string;
  taxId: string;
  businessType: BusinessType;
  industry: string;
  address: string;
  country: string;
  yearEstablished: string;
}

interface BusinessDocument {
  type: 'certificate' | 'tax_certificate' | 'proof_of_address';
  uri: string;
  name: string;
}

interface BeneficialOwner {
  id: string;
  fullName: string;
  ownershipPercentage: string;
  nationality: string;
  idDocumentUri: string | null;
}

interface Director {
  id: string;
  fullName: string;
  position: string;
  nationality: string;
  idDocumentUri: string | null;
}

export default function KYBVerificationScreen() {
  const router = useRouter();
  const colors = useColors();
  const [currentStep, setCurrentStep] = useState<VerificationStep>('intro');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Business Information
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    businessName: '',
    registrationNumber: '',
    taxId: '',
    businessType: 'limited_company',
    industry: '',
    address: '',
    country: '',
    yearEstablished: '',
  });

  // Business Documents
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);

  // Beneficial Owners
  const [beneficialOwners, setBeneficialOwners] = useState<BeneficialOwner[]>([
    { id: '1', fullName: '', ownershipPercentage: '', nationality: '', idDocumentUri: null },
  ]);

  // Directors
  const [directors, setDirectors] = useState<Director[]>([
    { id: '1', fullName: '', position: '', nationality: '', idDocumentUri: null },
  ]);

  const businessTypes = [
    { value: 'sole_proprietor', label: 'Sole Proprietor', icon: '👤' },
    { value: 'partnership', label: 'Partnership', icon: '🤝' },
    { value: 'limited_company', label: 'Limited Company', icon: '🏢' },
    { value: 'corporation', label: 'Corporation', icon: '🏛️' },
  ];

  const documentTypes = [
    { type: 'certificate', label: 'Certificate of Incorporation', required: true },
    { type: 'tax_certificate', label: 'Tax Registration Certificate', required: true },
    { type: 'proof_of_address', label: 'Proof of Business Address', required: true },
  ];

  const handleNext = () => {
    const stepOrder: VerificationStep[] = ['intro', 'business-info', 'business-documents', 'beneficial-owners', 'directors', 'review', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepOrder: VerificationStep[] = ['intro', 'business-info', 'business-documents', 'beneficial-owners', 'directors', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    } else {
      router.back();
    }
  };

  const pickDocument = async (documentType: 'certificate' | 'tax_certificate' | 'proof_of_address') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newDocument: BusinessDocument = {
        type: documentType,
        uri: result.assets[0].uri,
        name: documentTypes.find(d => d.type === documentType)?.label || 'Document',
      };
      setDocuments(prev => [...prev.filter(d => d.type !== documentType), newDocument]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const addBeneficialOwner = () => {
    const newId = (beneficialOwners.length + 1).toString();
    setBeneficialOwners(prev => [...prev, {
      id: newId,
      fullName: '',
      ownershipPercentage: '',
      nationality: '',
      idDocumentUri: null,
    }]);
  };

  const removeBeneficialOwner = (id: string) => {
    if (beneficialOwners.length > 1) {
      setBeneficialOwners(prev => prev.filter(owner => owner.id !== id));
    }
  };

  const updateBeneficialOwner = (id: string, field: keyof BeneficialOwner, value: string) => {
    setBeneficialOwners(prev => prev.map(owner =>
      owner.id === id ? { ...owner, [field]: value } : owner
    ));
  };

  const addDirector = () => {
    const newId = (directors.length + 1).toString();
    setDirectors(prev => [...prev, {
      id: newId,
      fullName: '',
      position: '',
      nationality: '',
      idDocumentUri: null,
    }]);
  };

  const removeDirector = (id: string) => {
    if (directors.length > 1) {
      setDirectors(prev => prev.filter(director => director.id !== id));
    }
  };

  const updateDirector = (id: string, field: keyof Director, value: string) => {
    setDirectors(prev => prev.map(director =>
      director.id === id ? { ...director, [field]: value } : director
    ));
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate all required fields
      if (!businessInfo.businessName || !businessInfo.registrationNumber || !businessInfo.taxId) {
        Alert.alert('Error', 'Please fill in all required business information');
        return;
      }

      if (documents.length < 3) {
        Alert.alert('Error', 'Please upload all required business documents');
        return;
      }

      // Transform local state to API format
      const businessData: BusinessRegistrationData = {
        businessName: businessInfo.businessName,
        registrationNumber: businessInfo.registrationNumber,
        businessType: businessInfo.businessType === 'sole_proprietor' ? 'sole_proprietorship' : 
                      businessInfo.businessType === 'limited_company' ? 'limited_liability' : 
                      businessInfo.businessType as any,
        country: businessInfo.country,
        registrationDate: businessInfo.yearEstablished + '-01-01',
        taxId: businessInfo.taxId,
        industry: businessInfo.industry,
        email: '', // TODO: Get from user profile
        phone: '', // TODO: Get from user profile
        address: {
          street: businessInfo.address,
          city: '',
          state: '',
          postalCode: '',
          country: businessInfo.country,
        },
      };

      // Transform beneficial owners
      const apiOwners: APIBeneficialOwner[] = beneficialOwners.map(owner => ({
        firstName: owner.fullName.split(' ')[0] || '',
        lastName: owner.fullName.split(' ').slice(1).join(' ') || '',
        dateOfBirth: '', // TODO: Add DOB field
        nationality: owner.nationality,
        ownershipPercentage: parseFloat(owner.ownershipPercentage) || 0,
        idType: 'national_id',
        idNumber: '',
        idExpiryDate: '',
        isPoliticallyExposed: false,
        address: {
          street: '',
          city: '',
          state: '',
          postalCode: '',
          country: owner.nationality,
        },
      }));

      // Transform directors
      const apiDirectors: APIDirector[] = directors.map(director => ({
        firstName: director.fullName.split(' ')[0] || '',
        lastName: director.fullName.split(' ').slice(1).join(' ') || '',
        dateOfBirth: '', // TODO: Add DOB field
        nationality: director.nationality,
        position: director.position,
        appointmentDate: new Date().toISOString().split('T')[0],
        idType: 'national_id',
        idNumber: '',
        idExpiryDate: '',
        isPoliticallyExposed: false,
      }));

      // Upload documents first
      const uploadedDocs: DocumentUpload[] = [];
      for (const doc of documents) {
        try {
          const uploaded = await kybService.uploadDocument({
            documentType: doc.type === 'certificate' ? 'business_registration' : 
                         doc.type === 'tax_certificate' ? 'tax_certificate' : 
                         'proof_of_address',
            file: {
              uri: doc.uri,
              name: doc.name,
              type: 'image/jpeg',
            },
          });
          uploadedDocs.push({
            documentType: doc.type === 'certificate' ? 'business_registration' : 
                         doc.type === 'tax_certificate' ? 'tax_certificate' : 
                         'proof_of_address',
            file: {
              uri: uploaded.url,
              name: doc.name,
              type: 'image/jpeg',
            },
          });
        } catch (uploadError) {
          console.error('Document upload failed:', uploadError);
          throw new Error(`Failed to upload ${doc.name}`);
        }
      }

      // Submit KYB verification
      const response = await kybService.submitKYBVerification({
        businessInfo: businessData,
        beneficialOwners: apiOwners,
        directors: apiDirectors,
        documents: uploadedDocs,
      });

      setVerificationId(response.verificationId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurrentStep('complete');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit KYB verification');
    } finally {
      setIsLoading(false);
    }
  };

  const renderIntro = () => (
    <ScrollView className="flex-1 p-6">
      <View className="items-center mb-8">
        <View 
          className="w-24 h-24 rounded-full items-center justify-center mb-4"
          style={{ backgroundColor: colors.primary + '20' }}
        >
          <Text className="text-5xl">🏢</Text>
        </View>
        <Text className="text-2xl font-bold text-foreground text-center mb-2">
          Business Verification (KYB)
        </Text>
        <Text className="text-base text-muted text-center">
          Verify your business to unlock merchant accounts, payment processing, and business banking features
        </Text>
      </View>

      <View className="bg-surface rounded-2xl p-4 mb-6">
        <Text className="text-lg font-semibold text-foreground mb-4">What you'll need:</Text>
        
        <View className="flex-row items-start mb-3">
          <View 
            className="w-8 h-8 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <Text className="text-primary font-bold">1</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">Business Documents</Text>
            <Text className="text-sm text-muted">Certificate of incorporation, tax ID, proof of address</Text>
          </View>
        </View>

        <View className="flex-row items-start mb-3">
          <View 
            className="w-8 h-8 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <Text className="text-primary font-bold">2</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">Beneficial Owners</Text>
            <Text className="text-sm text-muted">Information about all owners with 25%+ ownership</Text>
          </View>
        </View>

        <View className="flex-row items-start">
          <View 
            className="w-8 h-8 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <Text className="text-primary font-bold">3</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">Directors & Officers</Text>
            <Text className="text-sm text-muted">Details of company directors and key officers</Text>
          </View>
        </View>
      </View>

      <View className="bg-surface rounded-2xl p-4 mb-6">
        <Text className="text-sm text-muted mb-2">⏱️ Estimated time: 10-15 minutes</Text>
        <Text className="text-sm text-muted">🔒 Your data is encrypted and secure</Text>
        <Text className="text-sm text-muted">📋 Manual review within 24-48 hours</Text>
      </View>

      <TouchableOpacity
        className="rounded-full py-4 items-center"
        style={{ backgroundColor: colors.primary }}
        onPress={() => setCurrentStep('business-info')}
      >
        <Text className="text-background font-semibold text-base">Start Verification</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="py-4 items-center mt-2"
        onPress={() => router.back()}
      >
        <Text className="text-muted text-base">Maybe Later</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderBusinessInfo = () => (
    <ScrollView className="flex-1 p-6">
      <Text className="text-2xl font-bold text-foreground mb-2">Business Information</Text>
      <Text className="text-base text-muted mb-6">
        Provide basic information about your business
      </Text>

      {/* Business Type Selection */}
      <Text className="text-sm font-semibold text-foreground mb-2">Business Type *</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {businessTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            className="flex-1 min-w-[45%] bg-surface rounded-xl p-3 items-center"
            style={{
              borderWidth: 2,
              borderColor: businessInfo.businessType === type.value ? colors.primary : 'transparent',
            }}
            onPress={() => setBusinessInfo(prev => ({ ...prev, businessType: type.value as BusinessType }))}
          >
            <Text className="text-3xl mb-1">{type.icon}</Text>
            <Text className="text-sm font-semibold text-foreground text-center">{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Business Name */}
      <Text className="text-sm font-semibold text-foreground mb-2">Business Name *</Text>
      <TextInput
        className="bg-surface rounded-xl p-4 text-foreground mb-4"
        placeholder="Enter business name"
        placeholderTextColor={colors.muted}
        value={businessInfo.businessName}
        onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessName: text }))}
      />

      {/* Registration Number */}
      <Text className="text-sm font-semibold text-foreground mb-2">Registration Number *</Text>
      <TextInput
        className="bg-surface rounded-xl p-4 text-foreground mb-4"
        placeholder="Enter registration number"
        placeholderTextColor={colors.muted}
        value={businessInfo.registrationNumber}
        onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, registrationNumber: text }))}
      />

      {/* Tax ID */}
      <Text className="text-sm font-semibold text-foreground mb-2">Tax ID / TIN *</Text>
      <TextInput
        className="bg-surface rounded-xl p-4 text-foreground mb-4"
        placeholder="Enter tax identification number"
        placeholderTextColor={colors.muted}
        value={businessInfo.taxId}
        onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, taxId: text }))}
      />

      {/* Industry */}
      <Text className="text-sm font-semibold text-foreground mb-2">Industry *</Text>
      <TextInput
        className="bg-surface rounded-xl p-4 text-foreground mb-4"
        placeholder="e.g., Financial Services, E-commerce"
        placeholderTextColor={colors.muted}
        value={businessInfo.industry}
        onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, industry: text }))}
      />

      {/* Business Address */}
      <Text className="text-sm font-semibold text-foreground mb-2">Business Address *</Text>
      <TextInput
        className="bg-surface rounded-xl p-4 text-foreground mb-4"
        placeholder="Enter full business address"
        placeholderTextColor={colors.muted}
        multiline
        numberOfLines={3}
        value={businessInfo.address}
        onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, address: text }))}
      />

      {/* Country */}
      <Text className="text-sm font-semibold text-foreground mb-2">Country *</Text>
      <TextInput
        className="bg-surface rounded-xl p-4 text-foreground mb-4"
        placeholder="Enter country"
        placeholderTextColor={colors.muted}
        value={businessInfo.country}
        onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, country: text }))}
      />

      {/* Year Established */}
      <Text className="text-sm font-semibold text-foreground mb-2">Year Established *</Text>
      <TextInput
        className="bg-surface rounded-xl p-4 text-foreground mb-6"
        placeholder="YYYY"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        maxLength={4}
        value={businessInfo.yearEstablished}
        onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, yearEstablished: text }))}
      />

      <TouchableOpacity
        className="rounded-full py-4 items-center mb-4"
        style={{
          backgroundColor: businessInfo.businessName && businessInfo.registrationNumber && businessInfo.taxId
            ? colors.primary
            : colors.primary + '50',
        }}
        onPress={handleNext}
        disabled={!businessInfo.businessName || !businessInfo.registrationNumber || !businessInfo.taxId}
      >
        <Text className="text-background font-semibold text-base">Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderBusinessDocuments = () => (
    <ScrollView className="flex-1 p-6">
      <Text className="text-2xl font-bold text-foreground mb-2">Business Documents</Text>
      <Text className="text-base text-muted mb-6">
        Upload official business documents
      </Text>

      {documentTypes.map((docType) => {
        const uploadedDoc = documents.find(d => d.type === docType.type);
        return (
          <View key={docType.type} className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">
              {docType.label} {docType.required && '*'}
            </Text>
            {uploadedDoc ? (
              <View className="bg-surface rounded-xl p-4 flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View 
                    className="w-12 h-12 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: colors.success + '20' }}
                  >
                    <IconSymbol name="paperplane.fill" size={24} color={colors.success} />
                  </View>
                  <Text className="text-foreground font-semibold flex-1" numberOfLines={1}>
                    {docType.label}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDocuments(prev => prev.filter(d => d.type !== docType.type))}
                  className="ml-2"
                >
                  <Text className="text-error font-semibold">Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                className="bg-surface rounded-xl p-4 flex-row items-center justify-center border-2 border-dashed"
                style={{ borderColor: colors.border }}
                onPress={() => pickDocument(docType.type as 'certificate' | 'tax_certificate' | 'proof_of_address')}
              >
                <IconSymbol name="paperplane.fill" size={24} color={colors.primary} />
                <Text className="text-primary font-semibold ml-2">Upload Document</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <TouchableOpacity
        className="rounded-full py-4 items-center mb-4 mt-4"
        style={{
          backgroundColor: documents.length >= 3 ? colors.primary : colors.primary + '50',
        }}
        onPress={handleNext}
        disabled={documents.length < 3}
      >
        <Text className="text-background font-semibold text-base">Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderBeneficialOwners = () => (
    <ScrollView className="flex-1 p-6">
      <Text className="text-2xl font-bold text-foreground mb-2">Beneficial Owners</Text>
      <Text className="text-base text-muted mb-6">
        List all individuals who own 25% or more of the business
      </Text>

      {beneficialOwners.map((owner, index) => (
        <View key={owner.id} className="bg-surface rounded-2xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Owner {index + 1}</Text>
            {beneficialOwners.length > 1 && (
              <TouchableOpacity onPress={() => removeBeneficialOwner(owner.id)}>
                <Text className="text-error font-semibold">Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            className="bg-background rounded-xl p-3 text-foreground mb-3"
            placeholder="Full Name"
            placeholderTextColor={colors.muted}
            value={owner.fullName}
            onChangeText={(text) => updateBeneficialOwner(owner.id, 'fullName', text)}
          />

          <TextInput
            className="bg-background rounded-xl p-3 text-foreground mb-3"
            placeholder="Ownership Percentage (e.g., 50)"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            value={owner.ownershipPercentage}
            onChangeText={(text) => updateBeneficialOwner(owner.id, 'ownershipPercentage', text)}
          />

          <TextInput
            className="bg-background rounded-xl p-3 text-foreground"
            placeholder="Nationality"
            placeholderTextColor={colors.muted}
            value={owner.nationality}
            onChangeText={(text) => updateBeneficialOwner(owner.id, 'nationality', text)}
          />
        </View>
      ))}

      <TouchableOpacity
        className="bg-surface rounded-xl p-4 flex-row items-center justify-center mb-6 border-2 border-dashed"
        style={{ borderColor: colors.border }}
        onPress={addBeneficialOwner}
      >
        <IconSymbol name="paperplane.fill" size={24} color={colors.primary} />
        <Text className="text-primary font-semibold ml-2">Add Another Owner</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="rounded-full py-4 items-center mb-4"
        style={{ backgroundColor: colors.primary }}
        onPress={handleNext}
      >
        <Text className="text-background font-semibold text-base">Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderDirectors = () => (
    <ScrollView className="flex-1 p-6">
      <Text className="text-2xl font-bold text-foreground mb-2">Directors & Officers</Text>
      <Text className="text-base text-muted mb-6">
        List all company directors and key officers
      </Text>

      {directors.map((director, index) => (
        <View key={director.id} className="bg-surface rounded-2xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Director {index + 1}</Text>
            {directors.length > 1 && (
              <TouchableOpacity onPress={() => removeDirector(director.id)}>
                <Text className="text-error font-semibold">Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            className="bg-background rounded-xl p-3 text-foreground mb-3"
            placeholder="Full Name"
            placeholderTextColor={colors.muted}
            value={director.fullName}
            onChangeText={(text) => updateDirector(director.id, 'fullName', text)}
          />

          <TextInput
            className="bg-background rounded-xl p-3 text-foreground mb-3"
            placeholder="Position (e.g., CEO, CFO, Director)"
            placeholderTextColor={colors.muted}
            value={director.position}
            onChangeText={(text) => updateDirector(director.id, 'position', text)}
          />

          <TextInput
            className="bg-background rounded-xl p-3 text-foreground"
            placeholder="Nationality"
            placeholderTextColor={colors.muted}
            value={director.nationality}
            onChangeText={(text) => updateDirector(director.id, 'nationality', text)}
          />
        </View>
      ))}

      <TouchableOpacity
        className="bg-surface rounded-xl p-4 flex-row items-center justify-center mb-6 border-2 border-dashed"
        style={{ borderColor: colors.border }}
        onPress={addDirector}
      >
        <IconSymbol name="paperplane.fill" size={24} color={colors.primary} />
        <Text className="text-primary font-semibold ml-2">Add Another Director</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="rounded-full py-4 items-center mb-4"
        style={{ backgroundColor: colors.primary }}
        onPress={() => setCurrentStep('review')}
      >
        <Text className="text-background font-semibold text-base">Continue to Review</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderReview = () => (
    <ScrollView className="flex-1 p-6">
      <Text className="text-2xl font-bold text-foreground mb-2">Review Submission</Text>
      <Text className="text-base text-muted mb-6">
        Please review all information before submitting
      </Text>

      {/* Business Information Summary */}
      <View className="bg-surface rounded-2xl p-4 mb-4">
        <Text className="text-lg font-semibold text-foreground mb-3">Business Information</Text>
        <View className="gap-2">
          <View className="flex-row justify-between">
            <Text className="text-muted">Business Name:</Text>
            <Text className="text-foreground font-semibold">{businessInfo.businessName}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted">Registration #:</Text>
            <Text className="text-foreground font-semibold">{businessInfo.registrationNumber}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted">Tax ID:</Text>
            <Text className="text-foreground font-semibold">{businessInfo.taxId}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted">Type:</Text>
            <Text className="text-foreground font-semibold">
              {businessTypes.find(t => t.value === businessInfo.businessType)?.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Documents Summary */}
      <View className="bg-surface rounded-2xl p-4 mb-4">
        <Text className="text-lg font-semibold text-foreground mb-3">Documents</Text>
        <Text className="text-foreground">{documents.length} documents uploaded</Text>
      </View>

      {/* Beneficial Owners Summary */}
      <View className="bg-surface rounded-2xl p-4 mb-4">
        <Text className="text-lg font-semibold text-foreground mb-3">Beneficial Owners</Text>
        <Text className="text-foreground">{beneficialOwners.length} owner(s) declared</Text>
      </View>

      {/* Directors Summary */}
      <View className="bg-surface rounded-2xl p-4 mb-6">
        <Text className="text-lg font-semibold text-foreground mb-3">Directors & Officers</Text>
        <Text className="text-foreground">{directors.length} director(s) declared</Text>
      </View>

      <TouchableOpacity
        className="rounded-full py-4 items-center mb-4"
        style={{ backgroundColor: colors.primary }}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text className="text-background font-semibold text-base">Submit for Review</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="py-4 items-center"
        onPress={handleBack}
        disabled={isLoading}
      >
        <Text className="text-muted text-base">Go Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderComplete = () => (
    <View className="flex-1 items-center justify-center p-6">
      <View 
        className="w-24 h-24 rounded-full items-center justify-center mb-6"
        style={{ backgroundColor: colors.success + '20' }}
      >
        <IconSymbol name="house.fill" size={48} color={colors.success} />
      </View>
      <Text className="text-2xl font-bold text-foreground mb-2 text-center">
        KYB Verification Submitted!
      </Text>
      <Text className="text-muted text-center mb-8">
        We'll review your business documents and notify you within 24-48 hours. You'll receive an email once your business account is approved.
      </Text>
      <TouchableOpacity
        className="rounded-full py-4 px-8"
        style={{ backgroundColor: colors.primary }}
        onPress={() => router.back()}
      >
        <Text className="text-background font-semibold">Done</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (currentStep) {
      case 'intro':
        return renderIntro();
      case 'business-info':
        return renderBusinessInfo();
      case 'business-documents':
        return renderBusinessDocuments();
      case 'beneficial-owners':
        return renderBeneficialOwners();
      case 'directors':
        return renderDirectors();
      case 'review':
        return renderReview();
      case 'complete':
        return renderComplete();
      default:
        return null;
    }
  };

  const steps = [
    { id: 'business-info', title: 'Business Info' },
    { id: 'business-documents', title: 'Documents' },
    { id: 'beneficial-owners', title: 'Owners' },
    { id: 'directors', title: 'Directors' },
    { id: 'review', title: 'Review' },
  ];

  const getCurrentStepIndex = () => {
    return steps.findIndex(s => s.id === currentStep);
  };

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title: 'Business Verification',
          headerShown: currentStep !== 'intro' && currentStep !== 'complete',
        }}
      />
      
      {currentStep !== 'intro' && currentStep !== 'complete' && (
        <View className="px-6 pt-4 pb-2">
          <View className="flex-row items-center justify-between mb-4">
            {steps.map((step, index) => (
              <View key={step.id} className="flex-1 flex-row items-center">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: index <= getCurrentStepIndex() ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="font-bold text-sm"
                    style={{ color: index <= getCurrentStepIndex() ? colors.background : colors.muted }}
                  >
                    {index + 1}
                  </Text>
                </View>
                {index < steps.length - 1 && (
                  <View
                    className="flex-1 h-1 mx-2"
                    style={{
                      backgroundColor: index < getCurrentStepIndex() ? colors.primary : colors.border,
                    }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {renderContent()}
    </ScreenContainer>
  );
}
