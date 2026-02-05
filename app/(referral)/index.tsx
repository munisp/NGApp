import { View, Text, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

interface Referral {
  id: string;
  referredUser: string;
  status: 'pending' | 'completed';
  reward: number;
  date: string;
}

const REFERRAL_CODE_KEY = 'referralCode';
const REFERRALS_KEY = 'referrals';

export default function ReferralScreen() {
  const router = useRouter();
  const [referralCode, setReferralCode] = useState('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      // Load or generate referral code
      let code = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
      if (!code) {
        code = generateReferralCode();
        await AsyncStorage.setItem(REFERRAL_CODE_KEY, code);
      }
      setReferralCode(code);

      // Load referrals
      const stored = await AsyncStorage.getItem(REFERRALS_KEY);
      if (stored) {
        const refs = JSON.parse(stored);
        setReferrals(refs);
        const earned = refs
          .filter((r: Referral) => r.status === 'completed')
          .reduce((sum: number, r: Referral) => sum + r.reward, 0);
        setTotalEarned(earned);
      }
    } catch (error) {
      console.error('Failed to load referral data:', error);
    }
  };

  const generateReferralCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on this amazing fintech app! Use my referral code ${referralCode} to get $10 bonus when you sign up. Download now!`,
        title: 'Join with my referral code',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  const completedReferrals = referrals.filter(r => r.status === 'completed').length;
  const pendingReferrals = referrals.filter(r => r.status === 'pending').length;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Refer & Earn', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Earnings Summary */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30 items-center">
          <Text className="text-foreground font-bold text-xl mb-2">Total Earned</Text>
          <Text className="text-primary font-bold text-6xl mb-3">
            ${totalEarned.toFixed(2)}
          </Text>
          <View className="flex-row gap-6">
            <View className="items-center">
              <Text className="text-muted text-sm mb-1">Completed</Text>
              <Text className="text-foreground font-bold text-2xl">{completedReferrals}</Text>
            </View>
            <View className="items-center">
              <Text className="text-muted text-sm mb-1">Pending</Text>
              <Text className="text-warning font-bold text-2xl">{pendingReferrals}</Text>
            </View>
          </View>
        </View>

        {/* Referral Code Card */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4 text-center">
            Your Referral Code
          </Text>
          
          <View className="bg-primary/20 rounded-xl p-6 mb-4 items-center">
            <Text className="text-primary font-mono font-bold text-4xl tracking-widest">
              {referralCode}
            </Text>
          </View>

          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleCopy}
              className="flex-1 bg-surface border border-border rounded-xl py-3"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground text-center font-semibold">
                📋 Copy
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              className="flex-1 bg-primary rounded-xl py-3"
              style={{ opacity: 1 }}
            >
              <Text className="text-white text-center font-semibold">
                📤 Share
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* How it Works */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">How it Works</Text>
          
          <View className="flex-row mb-4">
            <View className="bg-primary rounded-full w-10 h-10 items-center justify-center mr-3">
              <Text className="text-white font-bold text-lg">1</Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold mb-1">Share Your Code</Text>
              <Text className="text-muted text-sm">
                Send your unique referral code to friends and family
              </Text>
            </View>
          </View>

          <View className="flex-row mb-4">
            <View className="bg-primary rounded-full w-10 h-10 items-center justify-center mr-3">
              <Text className="text-white font-bold text-lg">2</Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold mb-1">They Sign Up</Text>
              <Text className="text-muted text-sm">
                Your friend creates an account using your code
              </Text>
            </View>
          </View>

          <View className="flex-row">
            <View className="bg-primary rounded-full w-10 h-10 items-center justify-center mr-3">
              <Text className="text-white font-bold text-lg">3</Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold mb-1">Both Earn Rewards</Text>
              <Text className="text-muted text-sm">
                You get $10 and they get $10 when they complete their first transaction
              </Text>
            </View>
          </View>
        </View>

        {/* Rewards Info */}
        <View className="bg-success/10 rounded-xl p-4 mb-6 border border-success/30">
          <Text className="text-success font-semibold mb-2">💰 Earn More</Text>
          <Text className="text-muted text-sm">
            There's no limit! Refer as many friends as you want and earn $10 for each successful referral.
          </Text>
        </View>

        {/* View History Button */}
        <TouchableOpacity
          onPress={() => router.push('/(referral)/history' as any)}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            View Referral History
          </Text>
        </TouchableOpacity>

        {/* Leaderboard Button */}
        <TouchableOpacity
          onPress={() => router.push('/(referral)/leaderboard' as any)}
          className="bg-primary/20 border border-primary rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-primary text-center font-semibold text-lg">
            🏆 View Leaderboard
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
