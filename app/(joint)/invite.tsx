import { View, Text, TouchableOpacity, Alert, Share } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

export default function InvitePartnerScreen() {
  const router = useRouter();
  const [inviteCode] = useState(() => {
    // Generate random invite code
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  });

  const inviteLink = `https://fintech.app/join/${inviteCode}`;

  const copyInviteCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Invite code copied to clipboard');
  };

  const copyInviteLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Invite link copied to clipboard');
  };

  const shareInvite = async () => {
    try {
      await Share.share({
        message: `Join my joint account on Fintech App! Use code: ${inviteCode} or visit: ${inviteLink}`,
        title: 'Join My Joint Account',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Invite Partner', headerShown: true }} />

      <View className="flex-1">
        <Text className="text-foreground font-bold text-3xl mb-2">Invite Your Partner</Text>
        <Text className="text-muted mb-8">
          Share this code or link with your partner to join your joint account
        </Text>

        {/* Invite Code Display */}
        <View className="bg-primary rounded-2xl p-8 mb-6 items-center">
          <Text className="text-white/80 text-sm mb-3">Your Invite Code</Text>
          <Text className="text-white font-bold text-5xl tracking-wider mb-6">{inviteCode}</Text>
          <TouchableOpacity
            onPress={copyInviteCode}
            className="bg-white/20 rounded-xl px-6 py-3"
            style={{ opacity: 1 }}
          >
            <Text className="text-white font-semibold">Copy Code</Text>
          </TouchableOpacity>
        </View>

        {/* Invite Link */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-3">Invite Link</Text>
          <View className="bg-muted/10 rounded-lg p-4 mb-4">
            <Text className="text-muted text-sm" numberOfLines={1}>
              {inviteLink}
            </Text>
          </View>
          <TouchableOpacity
            onPress={copyInviteLink}
            className="bg-primary/10 border border-primary/30 rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-primary font-semibold text-center">Copy Link</Text>
          </TouchableOpacity>
        </View>

        {/* Share Button */}
        <TouchableOpacity
          onPress={shareInvite}
          className="bg-primary rounded-xl p-5 mb-4"
          style={{ opacity: 1 }}
        >
          <Text className="text-white font-bold text-center text-lg">Share Invite</Text>
        </TouchableOpacity>

        {/* Instructions */}
        <View className="bg-surface rounded-xl p-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-3">How it works</Text>
          <View className="gap-3">
            <View className="flex-row gap-3">
              <Text className="text-primary font-bold text-lg">1</Text>
              <Text className="text-foreground flex-1">
                Share the invite code or link with your partner
              </Text>
            </View>
            <View className="flex-row gap-3">
              <Text className="text-primary font-bold text-lg">2</Text>
              <Text className="text-foreground flex-1">
                They'll use it to join your joint account
              </Text>
            </View>
            <View className="flex-row gap-3">
              <Text className="text-primary font-bold text-lg">3</Text>
              <Text className="text-foreground flex-1">
                Start managing your shared finances together
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
