import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  joinedAt: string;
  avatar: string;
}

interface SharedAccount {
  id: string;
  name: string;
  balance: number;
  type: string;
}

export default function FamilyAccountsScreen() {
  const router = useRouter();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccount[]>([]);
  const [viewMode, setViewMode] = useState<'family' | 'individual'>('family');

  useEffect(() => {
    loadFamilyData();
  }, []);

  const loadFamilyData = async () => {
    try {
      const storedMembers = await AsyncStorage.getItem('familyMembers');
      const storedAccounts = await AsyncStorage.getItem('sharedAccounts');

      if (storedMembers && storedAccounts) {
        setMembers(JSON.parse(storedMembers));
        setSharedAccounts(JSON.parse(storedAccounts));
      } else {
        // Sample data
        const sampleMembers: FamilyMember[] = [
          {
            id: '1',
            name: 'You',
            email: 'you@example.com',
            role: 'admin',
            joinedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
            avatar: '👤',
          },
          {
            id: '2',
            name: 'Sarah Johnson',
            email: 'sarah@example.com',
            role: 'member',
            joinedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
            avatar: '👩',
          },
          {
            id: '3',
            name: 'Michael Johnson',
            email: 'michael@example.com',
            role: 'member',
            joinedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
            avatar: '👨',
          },
        ];

        const sampleAccounts: SharedAccount[] = [
          { id: '1', name: 'Family Savings', balance: 25000, type: 'Savings' },
          { id: '2', name: 'Joint Checking', balance: 8500, type: 'Checking' },
          { id: '3', name: 'Emergency Fund', balance: 15000, type: 'Savings' },
        ];

        await AsyncStorage.setItem('familyMembers', JSON.stringify(sampleMembers));
        await AsyncStorage.setItem('sharedAccounts', JSON.stringify(sampleAccounts));
        setMembers(sampleMembers);
        setSharedAccounts(sampleAccounts);
      }
    } catch (error) {
      console.error('Failed to load family data:', error);
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const updated = members.filter(m => m.id !== memberId);
      await AsyncStorage.setItem('familyMembers', JSON.stringify(updated));
      setMembers(updated);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const confirmRemove = (member: FamilyMember) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.name} from the family group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMember(member.id),
        },
      ]
    );
  };

  const totalBalance = sharedAccounts.reduce((sum, acc) => sum + acc.balance, 0);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Family Accounts', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Family Accounts</Text>
          <Text className="text-muted">Manage shared finances together</Text>
        </View>

        {/* View Toggle */}
        <View className="flex-row bg-surface rounded-xl p-1 mb-6 border border-border">
          <TouchableOpacity
            onPress={() => setViewMode('family')}
            className={`flex-1 rounded-lg p-3 ${
              viewMode === 'family' ? 'bg-primary' : ''
            }`}
            style={{ opacity: 1 }}
          >
            <Text
              className={`text-center font-semibold ${
                viewMode === 'family' ? 'text-white' : 'text-foreground'
              }`}
            >
              Family View
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('individual')}
            className={`flex-1 rounded-lg p-3 ${
              viewMode === 'individual' ? 'bg-primary' : ''
            }`}
            style={{ opacity: 1 }}
          >
            <Text
              className={`text-center font-semibold ${
                viewMode === 'individual' ? 'text-white' : 'text-foreground'
              }`}
            >
              My View
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'family' ? (
          <>
            {/* Total Balance */}
            <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
              <Text className="text-muted mb-2">Total Family Balance</Text>
              <Text className="text-foreground font-bold text-4xl mb-1">
                ${totalBalance.toLocaleString()}
              </Text>
              <Text className="text-muted text-sm">Across {sharedAccounts.length} shared accounts</Text>
            </View>

            {/* Shared Accounts */}
            <View className="mb-6">
              <Text className="text-foreground font-bold text-xl mb-4">Shared Accounts</Text>
              {sharedAccounts.map(account => (
                <TouchableOpacity
                  key={account.id}
                  onPress={() => router.push(`/(family)/account/${account.id}` as any)}
                  className="bg-surface rounded-xl p-5 mb-3 border border-border"
                  style={{ opacity: 1 }}
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1">
                      <Text className="text-foreground font-bold text-lg mb-1">
                        {account.name}
                      </Text>
                      <View className="bg-primary/20 px-3 py-1 rounded-full self-start">
                        <Text className="text-primary text-xs font-semibold">{account.type}</Text>
                      </View>
                    </View>
                    <Text className="text-foreground font-bold text-2xl">
                      ${account.balance.toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Family Members */}
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-foreground font-bold text-xl">Family Members</Text>
                <TouchableOpacity
                  onPress={() => router.push('/(family)/invite' as any)}
                  className="bg-primary px-4 py-2 rounded-full"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-white font-semibold">+ Invite</Text>
                </TouchableOpacity>
              </View>

              {members.map(member => (
                <TouchableOpacity
                  key={member.id}
                  onPress={() => router.push(`/(family)/member/${member.id}` as any)}
                  onLongPress={() => member.role !== 'admin' && confirmRemove(member)}
                  className="bg-surface rounded-xl p-5 mb-3 border border-border"
                  style={{ opacity: 1 }}
                >
                  <View className="flex-row items-center">
                    <View className="w-14 h-14 rounded-full bg-primary/20 items-center justify-center mr-4">
                      <Text className="text-3xl">{member.avatar}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-bold text-lg mb-1">
                        {member.name}
                      </Text>
                      <Text className="text-muted text-sm mb-1">{member.email}</Text>
                      <View className="flex-row items-center gap-2">
                        <View
                          className={`px-2 py-1 rounded-full ${
                            member.role === 'admin' ? 'bg-primary/20' : 'bg-muted/20'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              member.role === 'admin' ? 'text-primary' : 'text-muted'
                            }`}
                          >
                            {member.role.toUpperCase()}
                          </Text>
                        </View>
                        <Text className="text-muted text-xs">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Activity Feed */}
            <View className="mb-6">
              <Text className="text-foreground font-bold text-xl mb-4">Recent Activity</Text>
              <View className="bg-surface rounded-xl p-5 border border-border">
                <View className="items-center py-8">
                  <Text className="text-6xl mb-3">📊</Text>
                  <Text className="text-muted text-center">
                    Activity feed coming soon
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Individual View */}
            <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
              <Text className="text-foreground font-bold text-xl mb-4">My Personal Accounts</Text>
              <View className="items-center py-8">
                <Text className="text-6xl mb-3">💰</Text>
                <Text className="text-muted text-center mb-4">
                  Your personal accounts are separate from family accounts
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(account)/list' as any)}
                  className="bg-primary px-6 py-3 rounded-full"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-white font-semibold">View My Accounts</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
