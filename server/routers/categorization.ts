import { router, protectedProcedure } from "../_core/trpc.js";
import { z } from 'zod';

const transactionSchema = z.object({
  id: z.string(),
  description: z.string(),
  merchant: z.string().optional(),
  amount: z.number(),
  type: z.enum(['debit', 'credit']),
});

// Category definitions
const CATEGORIES: Record<string, { name: string; icon: string; keywords: string[] }> = {
  food: {
    name: 'Food & Dining',
    icon: '🍔',
    keywords: ['restaurant', 'food', 'cafe', 'coffee', 'pizza', 'burger', 'sushi', 'grocery', 'supermarket', 'dining', 'lunch', 'dinner', 'breakfast', 'mcdonald', 'kfc', 'starbucks', 'domino', 'subway'],
  },
  transport: {
    name: 'Transportation',
    icon: '🚗',
    keywords: ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'metro', 'train', 'bus', 'transport', 'shell', 'chevron', 'exxon', 'mobil', 'bp'],
  },
  shopping: {
    name: 'Shopping',
    icon: '🛍️',
    keywords: ['amazon', 'ebay', 'walmart', 'target', 'shopping', 'store', 'retail', 'mall', 'online', 'purchase', 'buy', 'shop', 'clothing', 'electronics', 'fashion'],
  },
  bills: {
    name: 'Bills & Utilities',
    icon: '💡',
    keywords: ['electric', 'water', 'gas', 'internet', 'phone', 'utility', 'bill', 'payment', 'subscription', 'netflix', 'spotify', 'hulu', 'insurance', 'rent', 'mortgage'],
  },
  entertainment: {
    name: 'Entertainment',
    icon: '🎬',
    keywords: ['movie', 'cinema', 'theater', 'concert', 'event', 'ticket', 'entertainment', 'game', 'gaming', 'steam', 'playstation', 'xbox', 'nintendo'],
  },
  health: {
    name: 'Health & Fitness',
    icon: '💪',
    keywords: ['gym', 'fitness', 'health', 'doctor', 'hospital', 'pharmacy', 'medical', 'clinic', 'medicine', 'cvs', 'walgreens', 'wellness', 'yoga', 'spa'],
  },
  transfer: {
    name: 'Transfer',
    icon: '💸',
    keywords: ['transfer', 'send', 'payment', 'paypal', 'venmo', 'zelle', 'cashapp', 'wire'],
  },
  income: {
    name: 'Income',
    icon: '💰',
    keywords: ['salary', 'paycheck', 'income', 'deposit', 'refund', 'reimbursement', 'payment received'],
  },
  other: {
    name: 'Other',
    icon: '📦',
    keywords: [],
  },
};

/**
 * Categorize a single transaction using keyword matching
 */
function categorizeTransaction(description: string, merchant?: string): {
  category: string;
  categoryName: string;
  categoryIcon: string;
  confidence: number;
  matchedKeywords: string[];
} {
  const text = `${description} ${merchant || ''}`.toLowerCase();
  
  // Count keyword matches for each category
  const categoryMatches: Record<string, string[]> = {};
  
  for (const [category, info] of Object.entries(CATEGORIES)) {
    categoryMatches[category] = [];
    for (const keyword of info.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        categoryMatches[category].push(keyword);
      }
    }
  }
  
  // Find category with most matches
  let bestCategory = 'other';
  let maxMatches = 0;
  
  for (const [category, matches] of Object.entries(categoryMatches)) {
    if (matches.length > maxMatches) {
      maxMatches = matches.length;
      bestCategory = category;
    }
  }
  
  // Calculate confidence based on number of matches
  const confidence = maxMatches > 0 ? Math.min(0.5 + (maxMatches * 0.15), 0.95) : 0.3;
  
  if (bestCategory !== 'other') {
    return {
      category: bestCategory,
      categoryName: CATEGORIES[bestCategory].name,
      categoryIcon: CATEGORIES[bestCategory].icon,
      confidence,
      matchedKeywords: categoryMatches[bestCategory],
    };
  }
  
  // Default to "other"
  return {
    category: 'other',
    categoryName: CATEGORIES.other.name,
    categoryIcon: CATEGORIES.other.icon,
    confidence: 0.3,
    matchedKeywords: [],
  };
}

export const categorizationRouter = router({
  /**
   * Categorize a batch of transactions
   */
  categorize: protectedProcedure
    .input(
      z.object({
        transactions: z.array(transactionSchema),
      })
    )
    .mutation(async ({ input }) => {
      const { transactions } = input;
      
      const categorized = transactions.map((txn) => ({
        ...txn,
        ...categorizeTransaction(txn.description, txn.merchant),
      }));
      
      return {
        success: true,
        transactions: categorized,
      };
    }),

  /**
   * Categorize a single transaction
   */
  categorizeSingle: protectedProcedure
    .input(
      z.object({
        description: z.string(),
        merchant: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { description, merchant } = input;
      
      const result = categorizeTransaction(description, merchant);
      
      return {
        success: true,
        ...result,
      };
    }),

  /**
   * Get all available categories
   */
  getCategories: protectedProcedure.query(async () => {
    return {
      success: true,
      categories: Object.entries(CATEGORIES).map(([key, value]) => ({
        key,
        name: value.name,
        icon: value.icon,
      })),
    };
  }),

  /**
   * Learn from user corrections (stub for future ML integration)
   */
  learn: protectedProcedure
    .input(
      z.object({
        transactionId: z.string(),
        description: z.string(),
        merchant: z.string().optional(),
        correctCategory: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Store user corrections for future ML model training
      // For now, just acknowledge the correction
      return {
        success: true,
        message: 'Thank you for the correction. This will help improve future categorizations.',
      };
    }),
});

export default categorizationRouter;
