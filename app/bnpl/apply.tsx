import { useState } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { trpc } from '@/lib/trpc';

export default function BNPLApplyScreen() {
  const colors = useColors();
  const [step, setStep] = useState(1);
  
  // Form state
  const [studentName, setStudentName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [schoolFeesAmount, setSchoolFeesAmount] = useState('');
  const [installmentPlan, setInstallmentPlan] = useState<3 | 6 | 12>(3);
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [documents, setDocuments] = useState<{
    id: string | null;
    proofOfIncome: string | null;
    studentId: string | null;
  }>({
    id: null,
    proofOfIncome: null,
    studentId: null
  });

  const createApplicationMutation = trpc.bnpl.createApplication.useMutation({
    onSuccess: () => {
      Alert.alert(
        'Application Submitted',
        'Your BNPL application has been submitted successfully. You will be notified once it is reviewed.',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    }
  });

  const handlePickDocument = async (type: 'id' | 'proofOfIncome' | 'studentId') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets[0]) {
        setDocuments(prev => ({
          ...prev,
          [type]: result.assets[0].uri
        }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!studentName || !schoolName || !grade || !schoolFeesAmount) {
        Alert.alert('Missing Information', 'Please fill in all fields');
        return;
      }
      setStep(2);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (step === 2) {
      if (!employmentStatus || !monthlyIncome) {
        Alert.alert('Missing Information', 'Please fill in all fields');
        return;
      }
      setStep(3);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      router.back();
    }
  };

  const handleSubmit = () => {
    if (!documents.id || !documents.proofOfIncome || !documents.studentId) {
      Alert.alert('Missing Documents', 'Please upload all required documents');
      return;
    }

    createApplicationMutation.mutate({
      student_name: studentName,
      school_name: schoolName,
      grade,
      school_fees_amount: parseFloat(schoolFeesAmount),
      installment_plan: installmentPlan,
      employment_status: employmentStatus,
      monthly_income: parseFloat(monthlyIncome),
      documents
    });
  };

  const calculateMonthlyPayment = () => {
    const amount = parseFloat(schoolFeesAmount);
    if (isNaN(amount)) return 0;
    const totalWithInterest = amount * 1.02; // 2% interest
    return Math.round(totalWithInterest / installmentPlan);
  };

  return (
    <ScreenContainer className="p-0">
      {/* Header */}
      <View className="bg-primary px-6 pt-6 pb-6">
        <View className="flex-row items-center mb-4">
          <Pressable
            onPress={handleBack}
            style={(state) => ({ opacity: state.pressed ? 0.6 : 1 })}
          >
            <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text className="text-xl font-bold text-white ml-4">Apply for BNPL</Text>
        </View>

        {/* Progress Indicator */}
        <View className="flex-row items-center justify-between">
          {[1, 2, 3].map((s) => (
            <View key={s} className="flex-row items-center flex-1">
              <View className={`w-8 h-8 rounded-full items-center justify-center ${
                s <= step ? 'bg-white' : 'bg-white/30'
              }`}>
                <Text className={`font-semibold ${s <= step ? 'text-primary' : 'text-white'}`}>
                  {s}
                </Text>
              </View>
              {s < 3 && (
                <View className={`flex-1 h-1 mx-2 ${s < step ? 'bg-white' : 'bg-white/30'}`} />
              )}
            </View>
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {step === 1 && (
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">Student Information</Text>
            <Text className="text-sm text-muted mb-6">
              Tell us about the student and their school
            </Text>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Student Name *</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Enter student's full name"
                placeholderTextColor={colors.muted}
                value={studentName}
                onChangeText={setStudentName}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">School Name *</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Enter school name"
                placeholderTextColor={colors.muted}
                value={schoolName}
                onChangeText={setSchoolName}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Grade/Class *</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="e.g., JSS 1, SS 2"
                placeholderTextColor={colors.muted}
                value={grade}
                onChangeText={setGrade}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">School Fees Amount *</Text>
              <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
                <Text className="text-foreground mr-2">₦</Text>
                <TextInput
                  className="flex-1 text-foreground"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={schoolFeesAmount}
                  onChangeText={setSchoolFeesAmount}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-3">Installment Plan *</Text>
              <View className="flex-row gap-3">
                {[3, 6, 12].map((months) => (
                  <Pressable
                    key={months}
                    className={`flex-1 border-2 rounded-xl p-4 ${
                      installmentPlan === months ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                    }`}
                    onPress={() => {
                      setInstallmentPlan(months as 3 | 6 | 12);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={(state) => ({ opacity: state.pressed ? 0.7 : 1 })}
                  >
                    <Text className={`text-center text-2xl font-bold mb-1 ${
                      installmentPlan === months ? 'text-primary' : 'text-foreground'
                    }`}>
                      {months}
                    </Text>
                    <Text className={`text-center text-xs ${
                      installmentPlan === months ? 'text-primary' : 'text-muted'
                    }`}>
                      months
                    </Text>
                  </Pressable>
                ))}
              </View>
              {schoolFeesAmount && (
                <View className="mt-4 bg-surface rounded-xl p-4 border border-border">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Monthly Payment</Text>
                    <Text className="text-lg font-bold text-primary">
                      ₦{calculateMonthlyPayment().toLocaleString()}/month
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">Employment Information</Text>
            <Text className="text-sm text-muted mb-6">
              Help us understand your financial situation
            </Text>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Employment Status *</Text>
              <View className="flex-row gap-3 mb-3">
                {['Employed', 'Self-Employed', 'Business Owner'].map((status) => (
                  <Pressable
                    key={status}
                    className={`flex-1 border-2 rounded-xl p-3 ${
                      employmentStatus === status ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                    }`}
                    onPress={() => {
                      setEmploymentStatus(status);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={(state) => ({ opacity: state.pressed ? 0.7 : 1 })}
                  >
                    <Text className={`text-center text-xs font-medium ${
                      employmentStatus === status ? 'text-primary' : 'text-foreground'
                    }`}>
                      {status}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-2">Monthly Income *</Text>
              <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
                <Text className="text-foreground mr-2">₦</Text>
                <TextInput
                  className="flex-1 text-foreground"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={monthlyIncome}
                  onChangeText={setMonthlyIncome}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">Upload Documents</Text>
            <Text className="text-sm text-muted mb-6">
              Please upload the following documents
            </Text>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Valid ID *</Text>
              <Pressable
                className="bg-surface border-2 border-dashed border-border rounded-xl p-6 items-center"
                onPress={() => handlePickDocument('id')}
                style={(state) => ({ opacity: state.pressed ? 0.7 : 1 })}
              >
                {documents.id ? (
                  <>
                    <IconSymbol name="checkmark.circle.fill" size={32} color={colors.success} />
                    <Text className="text-sm text-success mt-2">Document uploaded</Text>
                  </>
                ) : (
                  <>
                    <IconSymbol name="doc.badge.plus" size={32} color={colors.muted} />
                    <Text className="text-sm text-muted mt-2">Tap to upload</Text>
                  </>
                )}
              </Pressable>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Proof of Income *</Text>
              <Pressable
                className="bg-surface border-2 border-dashed border-border rounded-xl p-6 items-center"
                onPress={() => handlePickDocument('proofOfIncome')}
                style={(state) => ({ opacity: state.pressed ? 0.7 : 1 })}
              >
                {documents.proofOfIncome ? (
                  <>
                    <IconSymbol name="checkmark.circle.fill" size={32} color={colors.success} />
                    <Text className="text-sm text-success mt-2">Document uploaded</Text>
                  </>
                ) : (
                  <>
                    <IconSymbol name="doc.badge.plus" size={32} color={colors.muted} />
                    <Text className="text-sm text-muted mt-2">Tap to upload</Text>
                  </>
                )}
              </Pressable>
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-2">Student ID Card *</Text>
              <Pressable
                className="bg-surface border-2 border-dashed border-border rounded-xl p-6 items-center"
                onPress={() => handlePickDocument('studentId')}
                style={(state) => ({ opacity: state.pressed ? 0.7 : 1 })}
              >
                {documents.studentId ? (
                  <>
                    <IconSymbol name="checkmark.circle.fill" size={32} color={colors.success} />
                    <Text className="text-sm text-success mt-2">Document uploaded</Text>
                  </>
                ) : (
                  <>
                    <IconSymbol name="doc.badge.plus" size={32} color={colors.muted} />
                    <Text className="text-sm text-muted mt-2">Tap to upload</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Button */}
      <View className="px-6 py-4 border-t border-border bg-background">
        {step < 3 ? (
          <Pressable
            className="bg-primary py-4 rounded-full items-center"
            onPress={handleNext}
            style={(state) => ({ opacity: state.pressed ? 0.8 : 1 })}
          >
            <Text className="text-white font-semibold text-base">Continue</Text>
          </Pressable>
        ) : (
          <Pressable
            className="bg-primary py-4 rounded-full items-center"
            onPress={handleSubmit}
            disabled={createApplicationMutation.isPending}
            style={(state) => ({ opacity: state.pressed || createApplicationMutation.isPending ? 0.8 : 1 })}
          >
            <Text className="text-white font-semibold text-base">
              {createApplicationMutation.isPending ? 'Submitting...' : 'Submit Application'}
            </Text>
          </Pressable>
        )}
      </View>
    </ScreenContainer>
  );
}
