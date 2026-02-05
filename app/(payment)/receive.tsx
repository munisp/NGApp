import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Share, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';

export default function ReceiveMoneyScreen() {
  const { user } = useAuth();
  const [qrData, setQrData] = useState('');

  useEffect(() => {
    // Generate QR code data
    const data = JSON.stringify({
      user_id: user?.id,
      email: user?.email,
      name: `${user?.first_name} ${user?.last_name}`,
    });
    setQrData(data);
  }, [user]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Send money to ${user?.first_name}: ${user?.email}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1 items-center justify-center gap-6">
        {/* QR Code Placeholder */}
        <View className="bg-background border-4 border-primary rounded-2xl p-8">
          <View className="w-48 h-48 bg-surface items-center justify-center rounded-xl">
            <Text className="text-6xl">📱</Text>
            <Text className="text-muted text-sm mt-2">QR Code</Text>
          </View>
        </View>

        {/* User Info */}
        <View className="items-center gap-2">
          <Text className="text-2xl font-bold text-foreground">
            {user?.first_name} {user?.last_name}
          </Text>
          <Text className="text-muted">{user?.email}</Text>
        </View>

        {/* Share Button */}
        <TouchableOpacity
          className="bg-primary rounded-xl px-8 py-4"
          onPress={handleShare}
        >
          <Text className="text-background font-semibold text-lg">Share Details</Text>
        </TouchableOpacity>

        {/* Instructions */}
        <View className="bg-surface border border-border rounded-xl p-4 w-full">
          <Text className="text-foreground font-semibold mb-2">How to receive money</Text>
          <Text className="text-muted text-sm leading-relaxed">
            Share your QR code or email address with the sender. They can scan the code or enter your details to send you money.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
