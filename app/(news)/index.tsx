import { View, Text, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  category: 'markets' | 'personal-finance' | 'crypto' | 'economy' | 'investing';
  source: string;
  publishedAt: string;
  imageUrl?: string;
  url: string;
}

const sampleArticles: NewsArticle[] = [
  {
    id: '1',
    title: 'Stock Market Hits New Highs Amid Economic Recovery',
    summary: 'Major indices reach record levels as investors show confidence in economic growth prospects.',
    category: 'markets',
    source: 'Financial Times',
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    url: 'https://example.com/article1',
  },
  {
    id: '2',
    title: '5 Smart Ways to Build Your Emergency Fund',
    summary: 'Financial experts share practical strategies for creating a solid financial safety net.',
    category: 'personal-finance',
    source: 'Money Magazine',
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    url: 'https://example.com/article2',
  },
  {
    id: '3',
    title: 'Bitcoin Surges Past $50,000 Mark',
    summary: 'Cryptocurrency markets rally as institutional adoption continues to grow.',
    category: 'crypto',
    source: 'CoinDesk',
    publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    url: 'https://example.com/article3',
  },
  {
    id: '4',
    title: 'Understanding Compound Interest: The Key to Wealth Building',
    summary: 'Learn how compound interest can help you grow your savings exponentially over time.',
    category: 'investing',
    source: 'Investopedia',
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    url: 'https://example.com/article4',
  },
  {
    id: '5',
    title: 'Central Bank Announces Interest Rate Decision',
    summary: 'Policy makers maintain current rates while monitoring inflation trends.',
    category: 'economy',
    source: 'Bloomberg',
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    url: 'https://example.com/article5',
  },
  {
    id: '6',
    title: 'How to Maximize Your Retirement Savings',
    summary: 'Expert tips on making the most of your retirement accounts and tax advantages.',
    category: 'personal-finance',
    source: 'Forbes',
    publishedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    url: 'https://example.com/article6',
  },
];

const categoryColors: Record<string, string> = {
  markets: '#4ECDC4',
  'personal-finance': '#45B7D1',
  crypto: '#FFA07A',
  economy: '#98D8C8',
  investing: '#BB8FCE',
};

export default function NewsScreen() {
  const router = useRouter();
  const [articles, setArticles] = useState<NewsArticle[]>(sampleArticles);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const stored = await AsyncStorage.getItem('newsBookmarks');
      if (stored) {
        setBookmarkedIds(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  };

  const toggleBookmark = async (articleId: string) => {
    const newBookmarks = new Set(bookmarkedIds);
    if (newBookmarks.has(articleId)) {
      newBookmarks.delete(articleId);
    } else {
      newBookmarks.add(articleId);
    }
    setBookmarkedIds(newBookmarks);
    await AsyncStorage.setItem('newsBookmarks', JSON.stringify(Array.from(newBookmarks)));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const filteredArticles = articles.filter(article => {
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'markets', label: 'Markets' },
    { id: 'personal-finance', label: 'Personal Finance' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'economy', label: 'Economy' },
    { id: 'investing', label: 'Investing' },
  ];

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Financial News', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground font-bold text-3xl mb-2">Financial News</Text>
          <Text className="text-muted">Stay updated with the latest financial insights</Text>
        </View>

        {/* Search Bar */}
        <View className="bg-surface rounded-xl px-4 py-3 mb-4 flex-row items-center border border-border">
          <Text className="text-muted text-xl mr-3">🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search articles..."
            placeholderTextColor="#9BA1A6"
            className="flex-1 text-foreground text-base"
          />
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6"
          contentContainerStyle={{ gap: 12 }}
        >
          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              onPress={() => {
                setSelectedCategory(category.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className={`px-5 py-3 rounded-full ${
                selectedCategory === category.id
                  ? 'bg-primary'
                  : 'bg-surface border border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <Text
                className={`font-semibold ${
                  selectedCategory === category.id ? 'text-white' : 'text-muted'
                }`}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Articles */}
        {filteredArticles.length > 0 ? (
          <View className="gap-4">
            {filteredArticles.map(article => (
              <TouchableOpacity
                key={article.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/(news)/${article.id}` as any);
                }}
                className="bg-surface rounded-xl overflow-hidden border border-border"
                style={{ opacity: 1 }}
              >
                <View className="p-5">
                  {/* Category Badge */}
                  <View className="flex-row items-center justify-between mb-3">
                    <View
                      className="px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: `${categoryColors[article.category]}20`,
                      }}
                    >
                      <Text
                        className="text-xs font-semibold capitalize"
                        style={{ color: categoryColors[article.category] }}
                      >
                        {article.category.replace('-', ' ')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleBookmark(article.id);
                      }}
                      style={{ opacity: 1 }}
                    >
                      <Text className="text-2xl">
                        {bookmarkedIds.has(article.id) ? '🔖' : '📑'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Title */}
                  <Text className="text-foreground font-bold text-xl mb-2 leading-snug">
                    {article.title}
                  </Text>

                  {/* Summary */}
                  <Text className="text-muted leading-relaxed mb-4" numberOfLines={2}>
                    {article.summary}
                  </Text>

                  {/* Meta */}
                  <View className="flex-row items-center justify-between pt-4 border-t border-border">
                    <Text className="text-muted text-sm">{article.source}</Text>
                    <Text className="text-muted text-sm">{getTimeAgo(article.publishedAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View className="bg-surface rounded-xl p-12 items-center border border-border">
            <Text className="text-6xl mb-4">📰</Text>
            <Text className="text-foreground font-bold text-xl mb-2">No Articles Found</Text>
            <Text className="text-muted text-center">
              Try adjusting your search or category filter
            </Text>
          </View>
        )}

        {/* Bookmarked Articles */}
        {bookmarkedIds.size > 0 && (
          <View className="mt-8">
            <Text className="text-foreground font-bold text-2xl mb-4">Bookmarked Articles</Text>
            <Text className="text-muted mb-4">
              You have {bookmarkedIds.size} bookmarked article{bookmarkedIds.size !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
