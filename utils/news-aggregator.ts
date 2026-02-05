import AsyncStorage from "@react-native-async-storage/async-storage";

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content?: string;
  category: "markets" | "personal-finance" | "crypto" | "economy" | "investing" | "african-fintech";
  source: string;
  author?: string;
  publishedAt: string;
  imageUrl?: string;
  url: string;
  tags?: string[];
  relevanceScore?: number;
}

export interface NewsFilters {
  category?: string;
  searchQuery?: string;
  dateRange?: "today" | "week" | "month" | "all";
  sources?: string[];
}

const NEWS_CACHE_KEY = "@news_cache";
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// African fintech news sources
const AFRICAN_FINTECH_NEWS: NewsArticle[] = [
  {
    id: "af1",
    title: "Nigeria's OPay Reaches 40 Million Users, Eyes Regional Expansion",
    summary: "Leading Nigerian fintech OPay announces milestone user base and plans to expand services across West Africa.",
    category: "african-fintech",
    source: "TechCabal",
    publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    url: "https://techcabal.com",
    tags: ["nigeria", "mobile-money", "expansion"],
    relevanceScore: 0.95,
  },
  {
    id: "af2",
    title: "Kenya's M-Pesa Introduces Cross-Border Payments to 7 African Countries",
    summary: "Safaricom's M-Pesa launches instant cross-border money transfers, connecting millions across East Africa.",
    category: "african-fintech",
    source: "Business Daily Africa",
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    url: "https://businessdailyafrica.com",
    tags: ["kenya", "remittances", "cross-border"],
    relevanceScore: 0.92,
  },
  {
    id: "af3",
    title: "South African Fintech TymeBank Surpasses 7 Million Customers",
    summary: "Digital-only bank TymeBank achieves rapid growth with zero-fee banking and innovative savings products.",
    category: "african-fintech",
    source: "Ventureburn",
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    url: "https://ventureburn.com",
    tags: ["south-africa", "digital-banking", "growth"],
    relevanceScore: 0.88,
  },
  {
    id: "af4",
    title: "Flutterwave Secures $250M Series D, Valuation Hits $3 Billion",
    summary: "Pan-African payments company Flutterwave raises massive funding round to accelerate expansion.",
    category: "african-fintech",
    source: "TechCrunch",
    publishedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    url: "https://techcrunch.com",
    tags: ["funding", "payments", "unicorn"],
    relevanceScore: 0.90,
  },
  {
    id: "af5",
    title: "Ghana's Zeepay Partners with Visa for Digital Payments Expansion",
    summary: "Ghanaian fintech Zeepay announces strategic partnership with Visa to enhance digital payment infrastructure.",
    category: "african-fintech",
    source: "Ghana Business News",
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    url: "https://ghanabusinessnews.com",
    tags: ["ghana", "partnerships", "digital-payments"],
    relevanceScore: 0.85,
  },
];

// Global financial news
const GLOBAL_FINANCIAL_NEWS: NewsArticle[] = [
  {
    id: "gf1",
    title: "Stock Market Hits New Highs Amid Economic Recovery",
    summary: "Major indices reach record levels as investors show confidence in economic growth prospects.",
    category: "markets",
    source: "Financial Times",
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    url: "https://ft.com",
    tags: ["stocks", "markets", "economy"],
    relevanceScore: 0.80,
  },
  {
    id: "gf2",
    title: "5 Smart Ways to Build Your Emergency Fund",
    summary: "Financial experts share practical strategies for creating a solid financial safety net.",
    category: "personal-finance",
    source: "Money Magazine",
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    url: "https://money.com",
    tags: ["savings", "emergency-fund", "tips"],
    relevanceScore: 0.88,
  },
  {
    id: "gf3",
    title: "Bitcoin Surges Past $50,000 Mark",
    summary: "Cryptocurrency markets rally as institutional adoption continues to grow.",
    category: "crypto",
    source: "CoinDesk",
    publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    url: "https://coindesk.com",
    tags: ["bitcoin", "crypto", "markets"],
    relevanceScore: 0.75,
  },
  {
    id: "gf4",
    title: "Understanding Compound Interest: The Key to Wealth Building",
    summary: "Learn how compound interest can help you grow your savings exponentially over time.",
    category: "investing",
    source: "Investopedia",
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    url: "https://investopedia.com",
    tags: ["investing", "education", "wealth"],
    relevanceScore: 0.85,
  },
  {
    id: "gf5",
    title: "Central Banks Signal Cautious Approach to Interest Rates",
    summary: "Policy makers worldwide maintain current rates while monitoring inflation trends.",
    category: "economy",
    source: "Bloomberg",
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    url: "https://bloomberg.com",
    tags: ["interest-rates", "central-banks", "policy"],
    relevanceScore: 0.78,
  },
  {
    id: "gf6",
    title: "How to Maximize Your Retirement Savings in 2026",
    summary: "Expert tips on making the most of your retirement accounts and tax advantages.",
    category: "personal-finance",
    source: "Forbes",
    publishedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    url: "https://forbes.com",
    tags: ["retirement", "savings", "tax"],
    relevanceScore: 0.82,
  },
  {
    id: "gf7",
    title: "Emerging Markets Show Strong Growth Potential",
    summary: "Investors increasingly looking to developing economies for higher returns and diversification.",
    category: "investing",
    source: "The Economist",
    publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    url: "https://economist.com",
    tags: ["emerging-markets", "investing", "growth"],
    relevanceScore: 0.80,
  },
];

export async function fetchNews(filters?: NewsFilters): Promise<NewsArticle[]> {
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(NEWS_CACHE_KEY);
    if (cached) {
      const { articles, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return filterArticles(articles, filters);
      }
    }

    // Combine all news sources
    const allArticles = [...AFRICAN_FINTECH_NEWS, ...GLOBAL_FINANCIAL_NEWS];

    // Sort by relevance score and publish date
    allArticles.sort((a, b) => {
      const scoreA = a.relevanceScore || 0;
      const scoreB = b.relevanceScore || 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    // Cache the results
    await AsyncStorage.setItem(
      NEWS_CACHE_KEY,
      JSON.stringify({
        articles: allArticles,
        timestamp: Date.now(),
      })
    );

    return filterArticles(allArticles, filters);
  } catch (error) {
    console.error("Failed to fetch news:", error);
    return [];
  }
}

function filterArticles(articles: NewsArticle[], filters?: NewsFilters): NewsArticle[] {
  let filtered = [...articles];

  // Filter by category
  if (filters?.category && filters.category !== "all") {
    filtered = filtered.filter((article) => article.category === filters.category);
  }

  // Filter by search query
  if (filters?.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (article) =>
        article.title.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  // Filter by date range
  if (filters?.dateRange && filters.dateRange !== "all") {
    const now = Date.now();
    const ranges = {
      today: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };
    const range = ranges[filters.dateRange];
    filtered = filtered.filter(
      (article) => now - new Date(article.publishedAt).getTime() < range
    );
  }

  // Filter by sources
  if (filters?.sources && filters.sources.length > 0) {
    filtered = filtered.filter((article) => filters.sources!.includes(article.source));
  }

  return filtered;
}

export async function bookmarkArticle(articleId: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem("newsBookmarks");
    const bookmarks = stored ? new Set(JSON.parse(stored)) : new Set();
    bookmarks.add(articleId);
    await AsyncStorage.setItem("newsBookmarks", JSON.stringify(Array.from(bookmarks)));
  } catch (error) {
    console.error("Failed to bookmark article:", error);
  }
}

export async function unbookmarkArticle(articleId: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem("newsBookmarks");
    if (stored) {
      const bookmarks = new Set(JSON.parse(stored));
      bookmarks.delete(articleId);
      await AsyncStorage.setItem("newsBookmarks", JSON.stringify(Array.from(bookmarks)));
    }
  } catch (error) {
    console.error("Failed to unbookmark article:", error);
  }
}

export async function getBookmarkedArticles(): Promise<NewsArticle[]> {
  try {
    const stored = await AsyncStorage.getItem("newsBookmarks");
    if (!stored) return [];

    const bookmarkIds = new Set(JSON.parse(stored));
    const allArticles = await fetchNews();
    return allArticles.filter((article) => bookmarkIds.has(article.id));
  } catch (error) {
    console.error("Failed to get bookmarked articles:", error);
    return [];
  }
}

export function getNewsSources(): string[] {
  const allArticles = [...AFRICAN_FINTECH_NEWS, ...GLOBAL_FINANCIAL_NEWS];
  return Array.from(new Set(allArticles.map((article) => article.source)));
}

export function getNewsCategories(): Array<{
  value: string;
  label: string;
  count: number;
}> {
  const allArticles = [...AFRICAN_FINTECH_NEWS, ...GLOBAL_FINANCIAL_NEWS];
  const categoryCounts: Record<string, number> = {};

  allArticles.forEach((article) => {
    categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
  });

  return [
    { value: "all", label: "All News", count: allArticles.length },
    { value: "african-fintech", label: "African Fintech", count: categoryCounts["african-fintech"] || 0 },
    { value: "markets", label: "Markets", count: categoryCounts["markets"] || 0 },
    { value: "personal-finance", label: "Personal Finance", count: categoryCounts["personal-finance"] || 0 },
    { value: "crypto", label: "Crypto", count: categoryCounts["crypto"] || 0 },
    { value: "economy", label: "Economy", count: categoryCounts["economy"] || 0 },
    { value: "investing", label: "Investing", count: categoryCounts["investing"] || 0 },
  ];
}

export async function clearNewsCache(): Promise<void> {
  await AsyncStorage.removeItem(NEWS_CACHE_KEY);
}
