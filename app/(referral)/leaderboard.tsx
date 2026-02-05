import { View, Text, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';

interface LeaderboardEntry {
  rank: number;
  name: string;
  referrals: number;
  earnings: number;
  isCurrentUser?: boolean;
}

// Mock leaderboard data
const leaderboardData: LeaderboardEntry[] = [
  { rank: 1, name: 'Sarah M.', referrals: 45, earnings: 450 },
  { rank: 2, name: 'John D.', referrals: 38, earnings: 380 },
  { rank: 3, name: 'Emma W.', referrals: 32, earnings: 320 },
  { rank: 4, name: 'Michael B.', referrals: 28, earnings: 280 },
  { rank: 5, name: 'You', referrals: 0, earnings: 0, isCurrentUser: true },
  { rank: 6, name: 'Lisa K.', referrals: 22, earnings: 220 },
  { rank: 7, name: 'David P.', referrals: 19, earnings: 190 },
  { rank: 8, name: 'Anna S.', referrals: 15, earnings: 150 },
  { rank: 9, name: 'Tom R.', referrals: 12, earnings: 120 },
  { rank: 10, name: 'Grace L.', referrals: 10, earnings: 100 },
];

export default function ReferralLeaderboardScreen() {
  const renderEntry = ({ item }: { item: LeaderboardEntry }) => {
    const getRankEmoji = (rank: number): string => {
      switch (rank) {
        case 1:
          return '🥇';
        case 2:
          return '🥈';
        case 3:
          return '🥉';
        default:
          return `${rank}`;
      }
    };

    return (
      <View
        className={`rounded-xl p-4 mb-3 border ${
          item.isCurrentUser
            ? 'bg-primary/10 border-primary'
            : 'bg-surface border-border'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${
              item.rank <= 3 ? 'bg-warning/20' : 'bg-surface border border-border'
            }`}>
              <Text className={`font-bold text-lg ${
                item.rank <= 3 ? 'text-warning' : 'text-foreground'
              }`}>
                {getRankEmoji(item.rank)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className={`font-bold text-lg ${
                item.isCurrentUser ? 'text-primary' : 'text-foreground'
              }`}>
                {item.name}
              </Text>
              <Text className="text-muted text-sm">
                {item.referrals} referral{item.referrals !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className={`font-bold text-xl ${
              item.isCurrentUser ? 'text-primary' : 'text-success'
            }`}>
              ${item.earnings}
            </Text>
            <Text className="text-muted text-xs">earned</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Leaderboard', headerShown: true }} />

      {/* Header */}
      <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30 items-center">
        <Text className="text-6xl mb-3">🏆</Text>
        <Text className="text-foreground font-bold text-2xl mb-2">Top Referrers</Text>
        <Text className="text-muted text-center">
          See who's earning the most from referrals this month
        </Text>
      </View>

      {/* Leaderboard */}
      <FlatList
        data={leaderboardData}
        renderItem={renderEntry}
        keyExtractor={item => item.rank.toString()}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}
