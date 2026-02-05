import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { expenseCategories, categoryMergeHistory, categoryUsageStats } from '../../drizzle/schema-expense-categories';
import { eq, and, sql, inArray } from 'drizzle-orm';

/**
 * Expense Categories Router
 * 
 * Manages custom expense categories with CRUD operations,
 * merging, splitting, and usage statistics
 */

// Default categories with icons and colors
const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: 'fork.knife', color: '#FF6B6B' },
  { name: 'Transportation', icon: 'car.fill', color: '#4ECDC4' },
  { name: 'Shopping', icon: 'cart.fill', color: '#95E1D3' },
  { name: 'Entertainment', icon: 'star.fill', color: '#F38181' },
  { name: 'Bills & Utilities', icon: 'bolt.fill', color: '#AA96DA' },
  { name: 'Healthcare', icon: 'heart.fill', color: '#FCBAD3' },
  { name: 'Education', icon: 'book.fill', color: '#A8D8EA' },
  { name: 'Travel', icon: 'airplane', color: '#FFD93D' },
  { name: 'Personal Care', icon: 'person.fill', color: '#6BCB77' },
  { name: 'Other', icon: 'ellipsis.circle.fill', color: '#95A5A6' },
];

export const expenseCategoriesRouter = router({
  // Get all categories for user (default + custom)
  getCategories: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Get custom categories
    const customCategories = await db
      .select()
      .from(expenseCategories)
      .where(
        and(
          eq(expenseCategories.userId, ctx.user.openId),
          eq(expenseCategories.isActive, true)
        )
      );

    // Get usage stats for all categories
    const stats = await db
      .select()
      .from(categoryUsageStats)
      .where(eq(categoryUsageStats.userId, ctx.user.openId));

    const statsMap = new Map(stats.map(s => [s.categoryId, s]));

    // Combine default and custom categories
    const defaultWithStats = DEFAULT_CATEGORIES.map((cat, index) => ({
      id: -(index + 1), // Negative IDs for default categories
      ...cat,
      isDefault: true,
      isActive: true,
      userId: ctx.user.openId,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentCategoryId: null,
      description: null,
      stats: {
        transactionCount: 0,
        totalAmount: 0,
        lastUsedAt: null,
      },
    }));

    const customWithStats = customCategories.map(cat => ({
      ...cat,
      stats: statsMap.get(cat.id) || {
        transactionCount: 0,
        totalAmount: 0,
        lastUsedAt: null,
      },
    }));

    return {
      categories: [...defaultWithStats, ...customWithStats],
      defaultCount: DEFAULT_CATEGORIES.length,
      customCount: customCategories.length,
    };
  }),

  // Create custom category
  createCategory: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        icon: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9A-F]{6}$/i),
        description: z.string().optional(),
        parentCategoryId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const [newCategory] = await db
        .insert(expenseCategories)
        .values({
          userId: ctx.user.openId,
          name: input.name,
          icon: input.icon,
          color: input.color,
          description: input.description || null,
          parentCategoryId: input.parentCategoryId || null,
          isDefault: false,
          isActive: true,
        })
        .returning();

      return {
        category: newCategory,
        message: 'Category created successfully',
      };
    }),

  // Update category
  updateCategory: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        name: z.string().min(1).max(100).optional(),
        icon: z.string().min(1).max(50).optional(),
        color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Cannot update default categories (negative IDs)
      if (input.categoryId < 0) {
        throw new Error('Cannot update default categories');
      }

      const updates: any = { updatedAt: new Date() };
      if (input.name) updates.name = input.name;
      if (input.icon) updates.icon = input.icon;
      if (input.color) updates.color = input.color;
      if (input.description !== undefined) updates.description = input.description;

      const [updated] = await db
        .update(expenseCategories)
        .set(updates)
        .where(
          and(
            eq(expenseCategories.id, input.categoryId),
            eq(expenseCategories.userId, ctx.user.openId)
          )
        )
        .returning();

      if (!updated) {
        throw new Error('Category not found');
      }

      return {
        category: updated,
        message: 'Category updated successfully',
      };
    }),

  // Delete category (soft delete)
  deleteCategory: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        reassignToCategoryId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Cannot delete default categories
      if (input.categoryId < 0) {
        throw new Error('Cannot delete default categories');
      }

      // Soft delete
      await db
        .update(expenseCategories)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(expenseCategories.id, input.categoryId),
            eq(expenseCategories.userId, ctx.user.openId)
          )
        );

      // TODO: Reassign transactions to new category if provided
      // This would require integration with transactions table

      return {
        message: 'Category deleted successfully',
      };
    }),

  // Merge categories
  mergeCategories: protectedProcedure
    .input(
      z.object({
        sourceCategoryIds: z.array(z.number()).min(2),
        targetCategoryId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Cannot merge default categories
      const hasDefaultCategory = input.sourceCategoryIds.some((id: number) => id < 0) || input.targetCategoryId < 0;
      if (hasDefaultCategory) {
        throw new Error('Cannot merge default categories');
      }

      // TODO: Count affected transactions
      // This would require integration with transactions table
      const transactionsAffected = 0;

      // Record merge history
      await db.insert(categoryMergeHistory).values({
        userId: ctx.user.openId,
        sourceCategoryIds: JSON.stringify(input.sourceCategoryIds),
        targetCategoryId: input.targetCategoryId,
        transactionsAffected,
      });

      // Soft delete source categories
      await db
        .update(expenseCategories)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            inArray(expenseCategories.id, input.sourceCategoryIds),
            eq(expenseCategories.userId, ctx.user.openId)
          )
        );

      // TODO: Reassign transactions from source categories to target
      // This would require integration with transactions table

      return {
        message: `Successfully merged ${input.sourceCategoryIds.length} categories`,
        transactionsAffected,
      };
    }),

  // Get category usage statistics
  getCategoryStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const stats = await db
      .select()
      .from(categoryUsageStats)
      .where(eq(categoryUsageStats.userId, ctx.user.openId));

    // Calculate totals
    const totalTransactions = stats.reduce((sum, s) => sum + s.transactionCount, 0);
    const totalAmount = stats.reduce((sum, s) => sum + s.totalAmount, 0);

    // Sort by usage
    const topCategories = stats
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, 5);

    return {
      stats,
      summary: {
        totalTransactions,
        totalAmount,
        categoriesUsed: stats.length,
        topCategories,
      },
    };
  }),

  // Get merge history
  getMergeHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const history = await db
      .select()
      .from(categoryMergeHistory)
      .where(eq(categoryMergeHistory.userId, ctx.user.openId))
      .orderBy(sql`${categoryMergeHistory.mergedAt} DESC`)
      .limit(20);

    return {
      history: history.map((h: any) => ({
        ...h,
        sourceCategoryIds: JSON.parse(h.sourceCategoryIds),
      })),
    };
  }),

  // Initialize default categories for new user
  initializeDefaultCategories: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Check if user already has categories
    const existing = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.userId, ctx.user.openId))
      .limit(1);

    if (existing.length > 0) {
      return { message: 'Categories already initialized' };
    }

    // Create default categories as custom categories for this user
    const categories = DEFAULT_CATEGORIES.map(cat => ({
      userId: ctx.user.openId,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isDefault: true,
      isActive: true,
    }));

    await db.insert(expenseCategories).values(categories);

    return {
      message: 'Default categories initialized',
      count: categories.length,
    };
  }),
});
