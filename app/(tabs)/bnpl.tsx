import { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Pressable, TextInput, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { trpc } from '@/lib/trpc';
import { DEMO } from '@/lib/demo-data';

interface BNPLApplication{
  id: string;
  studentName: string;
  schoolName: string;
  grade: string;
  schoolFeesAmount: string;
  installmentPlan: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'defaulted';
  monthlyPayment: string;
  totalAmount: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function BNPLScreen() {
  const colors = useColors();
  const [applications, setApplications] = useState<BNPLApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'history'>('active');

    // Fetch BNPL applications
    const { data: applicationsData, isLoading, isError } = trpc.bnpl.getApplications.useQuery();

    useEffect(() => {
      if (isError) {
        setApplications(DEMO.bnplApplications as BNPLApplication[]);
        setLoading(false);
      } else if (applicationsData) {
        setApplications(applicationsData);
        setLoading(false);
      }
    }, [applicationsData, isError]);

  const handleNewApplication = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/bnpl/apply');
  };

  const handleViewDetails = (applicationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/bnpl/${applicationId}`);
  };

  const filterApplications = () => {
    if (activeTab === 'active') {
      return applications.filter(app => app.status === 'approved');
    } else if (activeTab === 'pending') {
      return applications.filter(app => app.status === 'pending');
    } else {
      return applications.filter(app => app.status === 'rejected' || app.status === 'approved');
    }
  };

  const filteredApplications = filterApplications();

  return (
    <ScreenContainer className="p-0">
      {/* Header */}
      <View className="bg-primary px-6 pt-6 pb-8">
        <Text className="text-3xl font-bold text-white mb-2">School Fees</Text>
        <Text className="text-base text-white/80">Pay in installments, stress-free</Text>
      </View>

      {/* Tab Navigation */}
      <View className="flex-row bg-surface border-b border-border">
        <TouchableOpacity
          className={`flex-1 py-4 ${activeTab === 'active' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => {
            setActiveTab('active');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={{ opacity: activeTab === 'active' ? 1 : 0.6 }}
        >
          <Text className={`text-center font-semibold ${activeTab === 'active' ? 'text-primary' : 'text-muted'}`}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-4 ${activeTab === 'pending' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => {
            setActiveTab('pending');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={{ opacity: activeTab === 'pending' ? 1 : 0.6 }}
        >
          <Text className={`text-center font-semibold ${activeTab === 'pending' ? 'text-primary' : 'text-muted'}`}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-4 ${activeTab === 'history' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => {
            setActiveTab('history');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={{ opacity: activeTab === 'history' ? 1 : 0.6 }}
        >
          <Text className={`text-center font-semibold ${activeTab === 'history' ? 'text-primary' : 'text-muted'}`}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 py-4">
        {loading || isLoading ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-muted">Loading...</Text>
          </View>
        ) : filteredApplications.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
              <IconSymbol name="doc.text" size={32} color={colors.muted} />
            </View>
            <Text className="text-lg font-semibold text-foreground mb-2">
              No {activeTab} applications
            </Text>
            <Text className="text-sm text-muted text-center mb-6">
              {activeTab === 'active' 
                ? 'You don\'t have any active BNPL plans yet'
                : activeTab === 'pending'
                ? 'No pending applications at the moment'
                : 'Your application history will appear here'}
            </Text>
            {activeTab === 'active' && (
              <Pressable
                className="bg-primary px-6 py-3 rounded-full"
                onPress={handleNewApplication}
                style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
              >
                <Text className="text-white font-semibold">Apply for BNPL</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {filteredApplications.map((application) => (
              <Pressable
                key={application.id}
                className="bg-surface rounded-2xl p-4 mb-4 border border-border"
                onPress={() => handleViewDetails(application.id)}
                style={({ pressed }: { pressed: boolean }) => [{ opacity: pressed ? 0.8 : 1 }]}
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-foreground mb-1">
                      {application.studentName}
                    </Text>
                    <Text className="text-sm text-muted">
                      {application.schoolName} • Grade {application.grade}
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${
                    application.status === 'approved' ? 'bg-success/20' :
                    application.status === 'pending' ? 'bg-warning/20' :
                    'bg-error/20'
                  }`}>
                    <Text className={`text-xs font-semibold ${
                      application.status === 'approved' ? 'text-success' :
                      application.status === 'pending' ? 'text-warning' :
                      'text-error'
                    }`}>
                      {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View className="border-t border-border pt-3">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-muted">School Fees</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      ₦{parseFloat(application.schoolFeesAmount).toLocaleString()}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-muted">Installment Plan</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {application.installmentPlan} months
                    </Text>
                  </View>
                  {application.status === 'approved' && (
                    <>
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-sm text-muted">Monthly Payment</Text>
                        <Text className="text-sm font-semibold text-primary">
                          ₦{parseFloat(application.monthlyPayment).toLocaleString()}/month
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Total Amount</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          ₦{parseFloat(application.totalAmount).toLocaleString()}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                <View className="flex-row items-center justify-end mt-3">
                  <Text className="text-xs text-primary font-medium mr-1">View Details</Text>
                  <IconSymbol name="chevron.right" size={16} color={colors.primary} />
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      {!loading && !isLoading && (
        <View className="absolute bottom-6 right-6">
          <Pressable
            className="bg-primary w-14 h-14 rounded-full items-center justify-center shadow-lg"
            onPress={handleNewApplication}
            style={({ pressed }: { pressed: boolean }) => [
              { 
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }]
              }
            ]}
          >
            <IconSymbol name="plus" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}
