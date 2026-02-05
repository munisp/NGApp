import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { userService, KYCDocument } from '@/lib/api/services-mock';

export default function KYCStatusScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKYCStatus();
  }, []);

  const loadKYCStatus = async () => {
    try {
      const data = await userService.getKYCStatus();
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load KYC status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return '✅';
      case 'pending':
        return '⏳';
      case 'rejected':
        return '❌';
      default:
        return '📄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-success';
      case 'pending':
        return 'text-warning';
      case 'rejected':
        return 'text-error';
      default:
        return 'text-muted';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success/20';
      case 'pending':
        return 'bg-warning/20';
      case 'rejected':
        return 'bg-error/20';
      default:
        return 'bg-muted/20';
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'KYC Status' }} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text className="text-muted mt-4">Loading KYC status...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'KYC Status' }} />

      <ScrollView className="flex-1">
        {/* Overall Status Card */}
        <View className={`rounded-2xl p-6 mb-6 ${getStatusBgColor(user?.kyc_status || 'pending')}`}>
          <View className="items-center">
            <Text className="text-6xl mb-3">{getStatusIcon(user?.kyc_status || 'pending')}</Text>
            <Text className="text-2xl font-bold text-foreground mb-2">
              {user?.kyc_status === 'verified' ? 'Verified' : user?.kyc_status === 'pending' ? 'Pending Review' : 'Not Verified'}
            </Text>
            <Text className="text-muted text-center">
              {user?.kyc_status === 'verified'
                ? 'Your identity has been verified'
                : user?.kyc_status === 'pending'
                ? 'Your documents are being reviewed'
                : 'Please submit your documents for verification'}
            </Text>
          </View>
        </View>

        {/* Documents List */}
        {documents.length > 0 ? (
          <>
            <Text className="text-lg font-bold text-foreground mb-3">Submitted Documents</Text>
            <View className="bg-surface rounded-xl border border-border overflow-hidden mb-6">
              {documents.map((doc, index) => (
                <View
                  key={doc.id}
                  className={`p-4 ${index < documents.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1">
                      <Text className="text-2xl mr-3">{getStatusIcon(doc.status)}</Text>
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold capitalize">
                          {doc.document_type.replace('_', ' ')}
                        </Text>
                        <Text className="text-muted text-xs">
                          Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View className={`px-3 py-1 rounded-full ${getStatusBgColor(doc.status)}`}>
                      <Text className={`text-xs font-medium ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View className="bg-surface rounded-xl p-6 items-center border border-border mb-6">
            <Text className="text-4xl mb-3">📄</Text>
            <Text className="text-foreground font-semibold mb-2">No Documents Submitted</Text>
            <Text className="text-muted text-center">
              You haven't submitted any documents yet
            </Text>
          </View>
        )}

        {/* Action Button */}
        {user?.kyc_status !== 'verified' && (
          <TouchableOpacity
            onPress={() => router.push('/(profile)/kyc')}
            className="bg-primary rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {documents.length > 0 ? 'Submit Additional Documents' : 'Start Verification'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Information */}
        <View className="bg-surface rounded-xl p-4 mt-6 border border-border">
          <Text className="text-foreground font-semibold mb-2">Why verify your identity?</Text>
          <Text className="text-muted text-sm mb-2">
            • Increase your transaction limits
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Access all platform features
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Comply with financial regulations
          </Text>
          <Text className="text-muted text-sm">
            • Protect your account from fraud
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
