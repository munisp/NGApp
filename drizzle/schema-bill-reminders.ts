import { pgTable, serial, varchar, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

/**
 * Bill Reminders Schema
 * 
 * Supports recurring bill tracking, payment reminders, and auto-pay
 */

export const billReminders = pgTable('bill_reminders', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  merchantName: varchar('merchant_name', { length: 200 }).notNull(),
  merchantLogo: text('merchant_logo'), // URL to merchant logo
  categoryId: integer('category_id'), // Link to expense category
  
  // Bill details
  amount: integer('amount').notNull(), // In kobo, can be estimated
  isAmountVariable: boolean('is_amount_variable').notNull().default(false),
  
  // Recurrence
  frequency: varchar('frequency', { length: 50 }).notNull(), // monthly, quarterly, yearly
  dueDay: integer('due_day').notNull(), // Day of month (1-31)
  nextDueDate: timestamp('next_due_date').notNull(),
  
  // Auto-pay
  autoPayEnabled: boolean('auto_pay_enabled').notNull().default(false),
  linkedAccountId: integer('linked_account_id'), // Bank account for auto-pay
  
  // Reminders
  reminderDaysBefore: integer('reminder_days_before').notNull().default(3),
  reminderEnabled: boolean('reminder_enabled').notNull().default(true),
  
  // Status
  isActive: boolean('is_active').notNull().default(true),
  
  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const billPayments = pgTable('bill_payments', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  billReminderId: integer('bill_reminder_id').notNull(),
  
  // Payment details
  amount: integer('amount').notNull(), // In kobo
  dueDate: timestamp('due_date').notNull(),
  paidDate: timestamp('paid_date'),
  
  // Status
  status: varchar('status', { length: 50 }).notNull(), // pending, paid, overdue, failed
  paymentMethod: varchar('payment_method', { length: 100 }), // manual, auto-pay
  
  // Transaction reference
  transactionId: varchar('transaction_id', { length: 255 }),
  
  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const billPredictions = pgTable('bill_predictions', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  billReminderId: integer('bill_reminder_id').notNull(),
  
  // Prediction data
  predictedAmount: integer('predicted_amount').notNull(), // In kobo
  confidence: integer('confidence').notNull(), // 0-100
  basedOnPayments: integer('based_on_payments').notNull(), // Number of historical payments used
  
  // Prediction period
  forMonth: integer('for_month').notNull(), // 1-12
  forYear: integer('for_year').notNull(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
