import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { billReminders, billPayments, billPredictions } from '../../drizzle/schema-bill-reminders';
import { eq, and, sql, lte, gte } from 'drizzle-orm';

/**
 * Bill Reminders Router
 * 
 * Manages recurring bills, payment reminders, and auto-pay functionality
 */

export const billRemindersRouter = router({
  // Get all bill reminders for user
  getBillReminders: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const reminders = await db
      .select()
      .from(billReminders)
      .where(
        and(
          eq(billReminders.userId, ctx.user.openId),
          eq(billReminders.isActive, true)
        )
      )
      .orderBy(sql`${billReminders.nextDueDate} ASC`);

    // Get payment history for each reminder
    const remindersWithPayments = await Promise.all(
      reminders.map(async (reminder) => {
        const payments = await db
          .select()
          .from(billPayments)
          .where(eq(billPayments.billReminderId, reminder.id))
          .orderBy(sql`${billPayments.dueDate} DESC`)
          .limit(6);

        return {
          ...reminder,
          recentPayments: payments,
          overdueCount: payments.filter(p => p.status === 'overdue').length,
        };
      })
    );

    return {
      reminders: remindersWithPayments,
      upcomingCount: remindersWithPayments.filter(
        r => new Date(r.nextDueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      ).length,
      autoPayCount: remindersWithPayments.filter(r => r.autoPayEnabled).length,
    };
  }),

  // Create bill reminder
  createBillReminder: protectedProcedure
    .input(
      z.object({
        merchantName: z.string().min(1).max(200),
        merchantLogo: z.string().optional(),
        categoryId: z.number().optional(),
        amount: z.number().positive(),
        isAmountVariable: z.boolean().default(false),
        frequency: z.enum(['monthly', 'quarterly', 'yearly']),
        dueDay: z.number().min(1).max(31),
        nextDueDate: z.string(),
        autoPayEnabled: z.boolean().default(false),
        linkedAccountId: z.number().optional(),
        reminderDaysBefore: z.number().min(0).max(30).default(3),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const [newReminder] = await db
        .insert(billReminders)
        .values({
          userId: ctx.user.openId,
          merchantName: input.merchantName,
          merchantLogo: input.merchantLogo || null,
          categoryId: input.categoryId || null,
          amount: Math.round(input.amount * 100), // Convert to kobo
          isAmountVariable: input.isAmountVariable,
          frequency: input.frequency,
          dueDay: input.dueDay,
          nextDueDate: new Date(input.nextDueDate),
          autoPayEnabled: input.autoPayEnabled,
          linkedAccountId: input.linkedAccountId || null,
          reminderDaysBefore: input.reminderDaysBefore,
          notes: input.notes || null,
        })
        .returning();

      // Create first payment record
      await db.insert(billPayments).values({
        userId: ctx.user.openId,
        billReminderId: newReminder.id,
        amount: Math.round(input.amount * 100),
        dueDate: new Date(input.nextDueDate),
        status: 'pending',
      });

      return {
        reminder: newReminder,
        message: 'Bill reminder created successfully',
      };
    }),

  // Update bill reminder
  updateBillReminder: protectedProcedure
    .input(
      z.object({
        reminderId: z.number(),
        merchantName: z.string().min(1).max(200).optional(),
        amount: z.number().positive().optional(),
        isAmountVariable: z.boolean().optional(),
        frequency: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
        dueDay: z.number().min(1).max(31).optional(),
        autoPayEnabled: z.boolean().optional(),
        linkedAccountId: z.number().optional(),
        reminderDaysBefore: z.number().min(0).max(30).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const updates: any = { updatedAt: new Date() };
      if (input.merchantName) updates.merchantName = input.merchantName;
      if (input.amount) updates.amount = Math.round(input.amount * 100);
      if (input.isAmountVariable !== undefined) updates.isAmountVariable = input.isAmountVariable;
      if (input.frequency) updates.frequency = input.frequency;
      if (input.dueDay) updates.dueDay = input.dueDay;
      if (input.autoPayEnabled !== undefined) updates.autoPayEnabled = input.autoPayEnabled;
      if (input.linkedAccountId) updates.linkedAccountId = input.linkedAccountId;
      if (input.reminderDaysBefore !== undefined) updates.reminderDaysBefore = input.reminderDaysBefore;
      if (input.notes !== undefined) updates.notes = input.notes;

      const [updated] = await db
        .update(billReminders)
        .set(updates)
        .where(
          and(
            eq(billReminders.id, input.reminderId),
            eq(billReminders.userId, ctx.user.openId)
          )
        )
        .returning();

      if (!updated) {
        throw new Error('Bill reminder not found');
      }

      return {
        reminder: updated,
        message: 'Bill reminder updated successfully',
      };
    }),

  // Delete bill reminder
  deleteBillReminder: protectedProcedure
    .input(z.object({ reminderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db
        .update(billReminders)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(billReminders.id, input.reminderId),
            eq(billReminders.userId, ctx.user.openId)
          )
        );

      return { message: 'Bill reminder deleted successfully' };
    }),

  // Mark bill as paid
  markBillAsPaid: protectedProcedure
    .input(
      z.object({
        paymentId: z.number(),
        paidDate: z.string().optional(),
        amount: z.number().positive().optional(),
        paymentMethod: z.string().optional(),
        transactionId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const updates: any = {
        status: 'paid',
        paidDate: input.paidDate ? new Date(input.paidDate) : new Date(),
        updatedAt: new Date(),
      };
      if (input.amount) updates.amount = Math.round(input.amount * 100);
      if (input.paymentMethod) updates.paymentMethod = input.paymentMethod;
      if (input.transactionId) updates.transactionId = input.transactionId;

      const [updated] = await db
        .update(billPayments)
        .set(updates)
        .where(
          and(
            eq(billPayments.id, input.paymentId),
            eq(billPayments.userId, ctx.user.openId)
          )
        )
        .returning();

      if (!updated) {
        throw new Error('Payment not found');
      }

      // Update next due date for the reminder
      const reminder = await db
        .select()
        .from(billReminders)
        .where(eq(billReminders.id, updated.billReminderId))
        .limit(1);

      if (reminder.length > 0) {
        const currentDueDate = new Date(reminder[0].nextDueDate);
        let nextDueDate = new Date(currentDueDate);

        switch (reminder[0].frequency) {
          case 'monthly':
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextDueDate.setMonth(nextDueDate.getMonth() + 3);
            break;
          case 'yearly':
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
            break;
        }

        await db
          .update(billReminders)
          .set({ nextDueDate, updatedAt: new Date() })
          .where(eq(billReminders.id, updated.billReminderId));

        // Create next payment record
        await db.insert(billPayments).values({
          userId: ctx.user.openId,
          billReminderId: updated.billReminderId,
          amount: reminder[0].amount,
          dueDate: nextDueDate,
          status: 'pending',
        });
      }

      return {
        payment: updated,
        message: 'Bill marked as paid successfully',
      };
    }),

  // Get upcoming bills (next 30 days)
  getUpcomingBills: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcoming = await db
      .select()
      .from(billReminders)
      .where(
        and(
          eq(billReminders.userId, ctx.user.openId),
          eq(billReminders.isActive, true),
          lte(billReminders.nextDueDate, thirtyDaysFromNow)
        )
      )
      .orderBy(sql`${billReminders.nextDueDate} ASC`);

    return {
      bills: upcoming,
      totalAmount: upcoming.reduce((sum, bill) => sum + bill.amount, 0),
    };
  }),

  // Get overdue bills
  getOverdueBills: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const now = new Date();

    const overdue = await db
      .select()
      .from(billPayments)
      .where(
        and(
          eq(billPayments.userId, ctx.user.openId),
          eq(billPayments.status, 'pending'),
          lte(billPayments.dueDate, now)
        )
      )
      .orderBy(sql`${billPayments.dueDate} ASC`);

    // Get reminder details for each overdue payment
    const overdueWithDetails = await Promise.all(
      overdue.map(async (payment) => {
        const [reminder] = await db
          .select()
          .from(billReminders)
          .where(eq(billReminders.id, payment.billReminderId))
          .limit(1);

        return {
          ...payment,
          reminder,
          daysOverdue: Math.floor(
            (now.getTime() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24)
          ),
        };
      })
    );

    return {
      overdueBills: overdueWithDetails,
      totalAmount: overdue.reduce((sum, bill) => sum + bill.amount, 0),
    };
  }),

  // Get bill payment history
  getPaymentHistory: protectedProcedure
    .input(z.object({ reminderId: z.number().optional(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const conditions = [eq(billPayments.userId, ctx.user.openId)];
      if (input.reminderId) {
        conditions.push(eq(billPayments.billReminderId, input.reminderId));
      }

      const query = db
        .select()
        .from(billPayments)
        .where(and(...conditions));

      const payments = await query
        .orderBy(sql`${billPayments.dueDate} DESC`)
        .limit(input.limit);

      return {
        payments,
        totalPaid: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
      };
    }),

  // Predict bill amount based on history
  predictBillAmount: protectedProcedure
    .input(z.object({ reminderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get last 6 payments
      const payments = await db
        .select()
        .from(billPayments)
        .where(
          and(
            eq(billPayments.billReminderId, input.reminderId),
            eq(billPayments.status, 'paid')
          )
        )
        .orderBy(sql`${billPayments.dueDate} DESC`)
        .limit(6);

      if (payments.length === 0) {
        throw new Error('Not enough payment history to predict');
      }

      // Calculate average
      const average = Math.round(
        payments.reduce((sum, p) => sum + p.amount, 0) / payments.length
      );

      // Calculate confidence based on variance
      const variance = payments.reduce((sum, p) => {
        const diff = p.amount - average;
        return sum + diff * diff;
      }, 0) / payments.length;

      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / average;
      const confidence = Math.max(0, Math.min(100, Math.round((1 - coefficientOfVariation) * 100)));

      // Save prediction
      const now = new Date();
      await db.insert(billPredictions).values({
        userId: ctx.user.openId,
        billReminderId: input.reminderId,
        predictedAmount: average,
        confidence,
        basedOnPayments: payments.length,
        forMonth: now.getMonth() + 1,
        forYear: now.getFullYear(),
      });

      return {
        predictedAmount: average,
        confidence,
        basedOnPayments: payments.length,
        message: 'Bill amount predicted successfully',
      };
    }),
});
