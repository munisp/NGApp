import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  emoji: string;
  articlesCount: number;
  completed: boolean;
}

const EDUCATION_PROGRESS_KEY = 'educationProgress';

const topics: Topic[] = [
  {
    id: '1',
    title: 'Budgeting Basics',
    description: 'Learn how to create and stick to a budget',
    category: 'Fundamentals',
    emoji: '💰',
    articlesCount: 5,
    completed: false,
  },
  {
    id: '2',
    title: 'Building Credit',
    description: 'Understand credit scores and how to improve them',
    category: 'Credit',
    emoji: '📊',
    articlesCount: 6,
    completed: false,
  },
  {
    id: '3',
    title: 'Investing 101',
    description: 'Introduction to stocks, bonds, and investment strategies',
    category: 'Investing',
    emoji: '📈',
    articlesCount: 8,
    completed: false,
  },
  {
    id: '4',
    title: 'Saving for Retirement',
    description: 'Plan for your financial future with retirement accounts',
    category: 'Retirement',
    emoji: '🏖️',
    articlesCount: 7,
    completed: false,
  },
  {
    id: '5',
    title: 'Managing Debt',
    description: 'Strategies to pay off debt and avoid common pitfalls',
    category: 'Debt',
    emoji: '💳',
    articlesCount: 5,
    completed: false,
  },
  {
    id: '6',
    title: 'Tax Essentials',
    description: 'Understanding taxes and maximizing deductions',
    category: 'Taxes',
    emoji: '📋',
    articlesCount: 6,
    completed: false,
  },
  {
    id: '7',
    title: 'Emergency Funds',
    description: 'Why you need one and how to build it',
    category: 'Savings',
    emoji: '🆘',
    articlesCount: 4,
    completed: false,
  },
  {
    id: '8',
    title: 'Insurance Basics',
    description: 'Types of insurance and how much you need',
    category: 'Insurance',
    emoji: '🛡️',
    articlesCount: 5,
    completed: false,
  },
];

export default function EducationHubScreen() {
  const router = useRouter();
  const [topicsWithProgress, setTopicsWithProgress] = useState<Topic[]>(topics);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const stored = await AsyncStorage.getItem(EDUCATION_PROGRESS_KEY);
      if (stored) {
        const progress = JSON.parse(stored);
        const updated = topics.map(topic => ({
          ...topic,
          completed: progress[topic.id] || false,
        }));
        setTopicsWithProgress(updated);
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
    }
  };

  const categories = ['all', ...Array.from(new Set(topics.map(t => t.category)))];
  const filteredTopics =
    filter === 'all' ? topicsWithProgress : topicsWithProgress.filter(t => t.category === filter);

  const completedCount = topicsWithProgress.filter(t => t.completed).length;
  const progressPercent = (completedCount / topics.length) * 100;

  const renderTopic = ({ item }: { item: Topic }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(education)/${item.id}` as any)}
      className="bg-surface rounded-xl p-6 mb-4 border border-border"
      style={{ opacity: 1 }}
    >
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center flex-1">
          <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mr-4">
            <Text className="text-4xl">{item.emoji}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-foreground font-bold text-lg mb-1">{item.title}</Text>
            <Text className="text-muted text-sm">{item.category}</Text>
          </View>
        </View>
        {item.completed && (
          <View className="w-10 h-10 bg-success/20 rounded-full items-center justify-center">
            <Text className="text-success text-2xl">✓</Text>
          </View>
        )}
      </View>

      <Text className="text-muted text-sm mb-3">{item.description}</Text>

      <View className="flex-row items-center justify-between">
        <Text className="text-muted text-xs">{item.articlesCount} articles</Text>
        <Text className="text-primary font-semibold text-sm">Learn More →</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Financial Education', headerShown: true }} />

      {/* Progress */}
      <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-foreground font-bold text-lg">Your Progress</Text>
          <Text className="text-primary font-bold text-2xl">{progressPercent.toFixed(0)}%</Text>
        </View>
        <View className="h-3 bg-border/30 rounded-full overflow-hidden mb-2">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
        <Text className="text-muted text-sm">
          {completedCount} of {topics.length} topics completed
        </Text>
      </View>

      {/* Category Filter */}
      <View className="mb-4">
        <Text className="text-foreground font-semibold mb-3">Categories</Text>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setFilter(item)}
              className={`mr-3 px-4 py-2 rounded-xl ${
                filter === item ? 'bg-primary' : 'bg-surface border border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <Text
                className={`font-semibold capitalize ${
                  filter === item ? 'text-white' : 'text-foreground'
                }`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Topics List */}
      <FlatList
        data={filteredTopics}
        renderItem={renderTopic}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-12">
            <Text className="text-6xl mb-4">📚</Text>
            <Text className="text-foreground font-semibold text-lg mb-2">No Topics Found</Text>
            <Text className="text-muted text-center">Try selecting a different category</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
