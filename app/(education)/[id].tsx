import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface Article {
  id: string;
  title: string;
  content: string;
  readTime: number;
}

const EDUCATION_PROGRESS_KEY = 'educationProgress';
const BOOKMARKS_KEY = 'educationBookmarks';

const topicContent: { [key: string]: { title: string; emoji: string; articles: Article[] } } = {
  '1': {
    title: 'Budgeting Basics',
    emoji: '💰',
    articles: [
      {
        id: '1-1',
        title: 'What is a Budget?',
        content:
          'A budget is a financial plan that helps you track income and expenses. It ensures you spend less than you earn and helps you achieve financial goals.\n\nKey components:\n• Income: All money coming in\n• Fixed expenses: Rent, utilities, insurance\n• Variable expenses: Food, entertainment\n• Savings: Emergency fund, retirement\n\nThe 50/30/20 rule is a popular budgeting method:\n• 50% for needs\n• 30% for wants\n• 20% for savings and debt repayment',
        readTime: 3,
      },
      {
        id: '1-2',
        title: 'Creating Your First Budget',
        content:
          'Follow these steps to create your budget:\n\n1. Calculate your monthly income\n2. List all fixed expenses\n3. Track variable expenses for a month\n4. Set realistic spending limits\n5. Plan for savings\n6. Review and adjust monthly\n\nTools to help:\n• Budgeting apps\n• Spreadsheets\n• Envelope method\n• Zero-based budgeting',
        readTime: 4,
      },
      {
        id: '1-3',
        title: 'Common Budgeting Mistakes',
        content:
          'Avoid these pitfalls:\n\n• Not tracking small expenses\n• Forgetting irregular expenses\n• Being too restrictive\n• Not adjusting for life changes\n• Giving up after one bad month\n\nRemember: Budgeting is a skill that improves with practice. Be patient with yourself and make adjustments as needed.',
        readTime: 3,
      },
    ],
  },
  '2': {
    title: 'Building Credit',
    emoji: '📊',
    articles: [
      {
        id: '2-1',
        title: 'Understanding Credit Scores',
        content:
          'Your credit score is a three-digit number (300-850) that represents your creditworthiness.\n\nFactors affecting your score:\n• Payment history (35%)\n• Credit utilization (30%)\n• Length of credit history (15%)\n• New credit (10%)\n• Credit mix (10%)\n\nScore ranges:\n• 800-850: Excellent\n• 740-799: Very Good\n• 670-739: Good\n• 580-669: Fair\n• 300-579: Poor',
        readTime: 4,
      },
      {
        id: '2-2',
        title: 'How to Build Credit',
        content:
          'Start building credit with these steps:\n\n1. Get a secured credit card\n2. Become an authorized user\n3. Pay all bills on time\n4. Keep credit utilization below 30%\n5. Don\'t close old accounts\n6. Diversify credit types\n\nBuilding good credit takes time, typically 6-12 months to see significant improvement.',
        readTime: 5,
      },
    ],
  },
  '3': {
    title: 'Investing 101',
    emoji: '📈',
    articles: [
      {
        id: '3-1',
        title: 'Why Invest?',
        content:
          'Investing helps your money grow faster than savings accounts through compound interest.\n\nBenefits of investing:\n• Beat inflation\n• Build wealth over time\n• Achieve financial goals\n• Generate passive income\n• Prepare for retirement\n\nThe power of compound interest: $10,000 invested at 7% annual return grows to $76,123 in 30 years.',
        readTime: 3,
      },
      {
        id: '3-2',
        title: 'Types of Investments',
        content:
          'Common investment options:\n\nStocks: Ownership in companies\n• Higher risk, higher potential return\n• Dividends + price appreciation\n\nBonds: Loans to companies/governments\n• Lower risk, steady income\n• Fixed interest payments\n\nMutual Funds: Diversified portfolios\n• Professional management\n• Lower minimum investment\n\nETFs: Exchange-traded funds\n• Low fees\n• Easy to buy and sell',
        readTime: 5,
      },
    ],
  },
};

export default function TopicDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const topicId = params.id as string;

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    loadStatus();
  }, [topicId]);

  const loadStatus = async () => {
    try {
      // Load completion status
      const progressStored = await AsyncStorage.getItem(EDUCATION_PROGRESS_KEY);
      if (progressStored) {
        const progress = JSON.parse(progressStored);
        setCompleted(progress[topicId] || false);
      }

      // Load bookmark status
      const bookmarksStored = await AsyncStorage.getItem(BOOKMARKS_KEY);
      if (bookmarksStored) {
        const bookmarks = JSON.parse(bookmarksStored);
        setIsBookmarked(bookmarks.includes(topicId));
      }
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  const toggleBookmark = async () => {
    try {
      const stored = await AsyncStorage.getItem(BOOKMARKS_KEY);
      let bookmarks: string[] = stored ? JSON.parse(stored) : [];

      if (isBookmarked) {
        bookmarks = bookmarks.filter(id => id !== topicId);
      } else {
        bookmarks.push(topicId);
      }

      await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
      setIsBookmarked(!isBookmarked);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  const markCompleted = async () => {
    try {
      const stored = await AsyncStorage.getItem(EDUCATION_PROGRESS_KEY);
      const progress = stored ? JSON.parse(stored) : {};
      progress[topicId] = true;
      await AsyncStorage.setItem(EDUCATION_PROGRESS_KEY, JSON.stringify(progress));
      setCompleted(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Great Job! 🎉', 'You\'ve completed this topic!', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Failed to mark completed:', error);
    }
  };

  const topic = topicContent[topicId];

  if (!topic) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Topic', headerShown: true }} />
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted">Topic not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const totalReadTime = topic.articles.reduce((sum, a) => sum + a.readTime, 0);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen
        options={{
          title: topic.title,
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity onPress={toggleBookmark} style={{ marginRight: 16 }}>
              <Text className="text-2xl">{isBookmarked ? '🔖' : '📑'}</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-surface rounded-xl p-8 mb-6 border border-border items-center">
          <Text className="text-8xl mb-4">{topic.emoji}</Text>
          <Text className="text-foreground font-bold text-3xl mb-2 text-center">
            {topic.title}
          </Text>
          <Text className="text-muted text-sm">{totalReadTime} min read</Text>
        </View>

        {completed && (
          <View className="bg-success/10 rounded-xl p-4 mb-6 border border-success/30">
            <Text className="text-success font-semibold text-center">✓ Completed</Text>
          </View>
        )}

        {/* Articles */}
        {topic.articles.map((article, index) => (
          <View key={article.id} className="bg-surface rounded-xl p-6 mb-4 border border-border">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-primary font-bold text-lg">
                {index + 1}. {article.title}
              </Text>
              <Text className="text-muted text-xs">{article.readTime} min</Text>
            </View>
            <Text className="text-foreground leading-relaxed whitespace-pre-line">
              {article.content}
            </Text>
          </View>
        ))}

        {/* Quiz Section */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-lg mb-3">📝 Test Your Knowledge</Text>
          <Text className="text-muted text-sm mb-4">
            Take a quiz to test your understanding of this topic.
          </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Quiz', 'Quiz feature coming soon! Practice what you\'ve learned.', [
                { text: 'OK' },
              ])
            }
            className="bg-primary rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-white text-center font-semibold">Start Quiz</Text>
          </TouchableOpacity>
        </View>

        {/* Mark Complete */}
        {!completed && (
          <TouchableOpacity
            onPress={markCompleted}
            className="bg-success rounded-xl p-4 mb-6"
            style={{ opacity: 1 }}
          >
            <Text className="text-white text-center font-semibold text-lg">
              ✓ Mark as Completed
            </Text>
          </TouchableOpacity>
        )}

        {/* Navigation */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            ← Back to Topics
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
