import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  source: string;
  publishedAt: string;
  author?: string;
  url: string;
}

const sampleArticles: Record<string, NewsArticle> = {
  '1': {
    id: '1',
    title: 'Stock Market Hits New Highs Amid Economic Recovery',
    summary: 'Major indices reach record levels as investors show confidence in economic growth prospects.',
    content: `The stock market reached new all-time highs today as investors showed renewed confidence in the economic recovery. Major indices including the S&P 500, Dow Jones, and NASDAQ all posted significant gains.

Analysts attribute the rally to several factors including strong corporate earnings, positive economic data, and optimism about future growth prospects. Technology and healthcare sectors led the gains, with many companies reporting better-than-expected quarterly results.

"We're seeing a broad-based rally across multiple sectors," said market analyst Sarah Johnson. "This suggests that investors are becoming more confident about the overall economic outlook."

The Federal Reserve's commitment to maintaining supportive monetary policy has also contributed to the positive market sentiment. However, some experts caution that valuations are becoming stretched and recommend a balanced approach to investing.

Looking ahead, market participants will be closely watching upcoming economic indicators and corporate earnings reports for signs of continued strength or potential headwinds.`,
    category: 'markets',
    source: 'Financial Times',
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    author: 'John Smith',
    url: 'https://example.com/article1',
  },
  '2': {
    id: '2',
    title: '5 Smart Ways to Build Your Emergency Fund',
    summary: 'Financial experts share practical strategies for creating a solid financial safety net.',
    content: `Building an emergency fund is one of the most important steps you can take toward financial security. Here are five smart strategies recommended by financial experts:

1. **Start Small, Think Big**
Don't be discouraged if you can't save large amounts immediately. Start with a goal of $500-$1,000 and gradually work your way up to 3-6 months of expenses.

2. **Automate Your Savings**
Set up automatic transfers from your checking account to a dedicated savings account. This "pay yourself first" approach ensures consistent progress.

3. **Find Extra Money**
Look for ways to increase your savings rate through side hustles, selling unused items, or redirecting windfalls like tax refunds.

4. **Keep It Separate**
Store your emergency fund in a high-yield savings account that's separate from your regular checking account to reduce temptation.

5. **Review and Adjust**
Regularly review your emergency fund target as your life circumstances change, such as getting married, having children, or changing jobs.

Remember, the goal is progress, not perfection. Every dollar you save brings you closer to financial peace of mind.`,
    category: 'personal-finance',
    source: 'Money Magazine',
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    author: 'Emily Chen',
    url: 'https://example.com/article2',
  },
};

export default function NewsArticleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    loadArticle();
    checkBookmark();
  }, [id]);

  const loadArticle = () => {
    const articleData = sampleArticles[id as string];
    if (articleData) {
      setArticle(articleData);
    } else {
      // Generate default content for other articles
      setArticle({
        id: id as string,
        title: 'Article Title',
        summary: 'Article summary',
        content: 'Full article content would be loaded here from the news API.',
        category: 'general',
        source: 'News Source',
        publishedAt: new Date().toISOString(),
        url: 'https://example.com',
      });
    }
  };

  const checkBookmark = async () => {
    try {
      const stored = await AsyncStorage.getItem('newsBookmarks');
      if (stored) {
        const bookmarks = new Set(JSON.parse(stored));
        setIsBookmarked(bookmarks.has(id as string));
      }
    } catch (error) {
      console.error('Failed to check bookmark:', error);
    }
  };

  const toggleBookmark = async () => {
    try {
      const stored = await AsyncStorage.getItem('newsBookmarks');
      const bookmarks = new Set(stored ? JSON.parse(stored) : []);
      
      if (bookmarks.has(id as string)) {
        bookmarks.delete(id as string);
      } else {
        bookmarks.add(id as string);
      }
      
      await AsyncStorage.setItem('newsBookmarks', JSON.stringify(Array.from(bookmarks)));
      setIsBookmarked(!isBookmarked);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  const openOriginalArticle = async () => {
    if (article?.url) {
      await Linking.openURL(article.url);
    }
  };

  if (!article) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Loading...', headerShown: true }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted">Loading article...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen
        options={{
          title: 'Article',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity onPress={toggleBookmark} style={{ opacity: 1 }}>
              <Text className="text-2xl mr-4">{isBookmarked ? '🔖' : '📑'}</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Category Badge */}
        <View className="mb-4">
          <View className="bg-primary/20 px-4 py-2 rounded-full self-start">
            <Text className="text-primary font-semibold capitalize">
              {article.category.replace('-', ' ')}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text className="text-foreground font-bold text-3xl mb-4 leading-tight">
          {article.title}
        </Text>

        {/* Meta */}
        <View className="flex-row items-center justify-between mb-6 pb-6 border-b border-border">
          <View>
            <Text className="text-foreground font-semibold">{article.source}</Text>
            {article.author && (
              <Text className="text-muted text-sm">By {article.author}</Text>
            )}
          </View>
          <Text className="text-muted text-sm">
            {new Date(article.publishedAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Summary */}
        <View className="bg-primary/5 rounded-xl p-5 mb-6 border border-primary/20">
          <Text className="text-foreground font-semibold text-lg leading-relaxed">
            {article.summary}
          </Text>
        </View>

        {/* Content */}
        <View className="mb-8">
          {article.content.split('\n\n').map((paragraph, index) => {
            // Check if paragraph is a heading (starts with **)
            if (paragraph.startsWith('**')) {
              const heading = paragraph.replace(/\*\*/g, '');
              return (
                <Text
                  key={index}
                  className="text-foreground font-bold text-xl mb-3 mt-4"
                >
                  {heading}
                </Text>
              );
            }
            
            return (
              <Text
                key={index}
                className="text-foreground text-base leading-relaxed mb-4"
              >
                {paragraph}
              </Text>
            );
          })}
        </View>

        {/* Read Original Button */}
        <TouchableOpacity
          onPress={openOriginalArticle}
          className="bg-primary rounded-xl p-5 mb-4"
          style={{ opacity: 1 }}
        >
          <Text className="text-white font-bold text-center text-lg">
            Read Original Article
          </Text>
        </TouchableOpacity>

        {/* Related Articles */}
        <View className="bg-surface rounded-xl p-6 border border-border">
          <Text className="text-foreground font-bold text-xl mb-3">Related Topics</Text>
          <View className="flex-row flex-wrap gap-2">
            {['Investing', 'Savings', 'Budgeting', 'Retirement'].map(topic => (
              <View key={topic} className="bg-muted/10 px-4 py-2 rounded-full">
                <Text className="text-muted font-semibold">{topic}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
