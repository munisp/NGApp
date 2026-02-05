import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

export default function InviteFamilyMemberScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');

  const inviteCode = 'FAMILY-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const sendInvite = async () => {
    if (!email.trim() || !name.trim()) {
      Alert.alert('Error', 'Please enter both name and email');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      const stored = await AsyncStorage.getItem('familyMembers');
      const members = stored ? JSON.parse(stored) : [];

      const newMember = {
        id: Date.now().toString(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        joinedAt: new Date().toISOString(),
        avatar: name.trim()[0].toUpperCase() === 'M' ? '👨' : '👩',
      };

      members.push(newMember);
      await AsyncStorage.setItem('familyMembers', JSON.stringify(members));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Invitation Sent!',
        `An invitation has been sent to ${email}. They can join using code: ${inviteCode}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to send invite:', error);
      Alert.alert('Error', 'Failed to send invitation');
    }
  };

  const copyInviteCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied!', 'Invite code copied to clipboard');
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Invite Family Member', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-2xl mb-2">
            Invite Family Member
          </Text>
          <Text className="text-muted">
            Add a family member to share accounts and manage finances together
          </Text>
        </View>

        {/* Name */}
        <View className="mb-4">
          <Text className="text-muted text-sm mb-2">Full Name</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground text-lg"
            placeholder="Enter full name"
            placeholderTextColor="#9BA1A6"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Email */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-2">Email Address</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground text-lg"
            placeholder="email@example.com"
            placeholderTextColor="#9BA1A6"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Role Selection */}
        <View className="mb-6">
          <Text className="text-muted text-sm mb-2">Access Level</Text>
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => setRole('member')}
              className={`rounded-xl p-4 border ${
                role === 'member'
                  ? 'bg-primary border-primary'
                  : 'bg-surface border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text
                    className={`font-bold text-lg mb-1 ${
                      role === 'member' ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    Member
                  </Text>
                  <Text
                    className={`text-sm ${
                      role === 'member' ? 'text-white/80' : 'text-muted'
                    }`}
                  >
                    Can view shared accounts and transactions
                  </Text>
                </View>
                {role === 'member' && <Text className="text-white text-2xl">✓</Text>}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setRole('admin')}
              className={`rounded-xl p-4 border ${
                role === 'admin'
                  ? 'bg-primary border-primary'
                  : 'bg-surface border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text
                    className={`font-bold text-lg mb-1 ${
                      role === 'admin' ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    Admin
                  </Text>
                  <Text
                    className={`text-sm ${
                      role === 'admin' ? 'text-white/80' : 'text-muted'
                    }`}
                  >
                    Can manage accounts, invite members, and make transactions
                  </Text>
                </View>
                {role === 'admin' && <Text className="text-white text-2xl">✓</Text>}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Invite Code */}
        <View className="bg-primary/10 rounded-xl p-5 mb-6 border border-primary/30">
          <Text className="text-foreground font-semibold mb-3">Invite Code</Text>
          <View className="flex-row items-center justify-between bg-surface rounded-lg p-4 mb-3 border border-border">
            <Text className="text-foreground font-mono text-xl">{inviteCode}</Text>
            <TouchableOpacity
              onPress={copyInviteCode}
              className="bg-primary px-4 py-2 rounded-lg"
              style={{ opacity: 1 }}
            >
              <Text className="text-white font-semibold">Copy</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-muted text-sm">
            Share this code with your family member to join the group
          </Text>
        </View>

        {/* Send Invite Button */}
        <TouchableOpacity
          onPress={sendInvite}
          className="bg-primary rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            Send Invitation
          </Text>
        </TouchableOpacity>

        {/* Info */}
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-muted text-sm leading-relaxed">
            💡 The invited member will receive an email with instructions to join your family
            group. They'll need to create an account or sign in to accept the invitation.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
