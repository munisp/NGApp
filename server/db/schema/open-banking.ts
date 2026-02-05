import { pgTable, varchar, numeric, timestamp, json, pgEnum, text, boolean } from 'drizzle-orm/pg-core';

export const bankConnectionStatusEnum = pgEnum('bank_connection_status', ['connected', 'disconnected', 'error', 'pending', 'active']);
export const accountStatusEnum = pgEnum('account_status', ['active', 'inactive']);
export const transactionTypeEnum = pgEnum('transaction_type', ['credit', 'debit']);

export const bankConnections = pgTable('bank_connections', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 36 }).notNull(),
  bankName: varchar('bank_name', { length: 255 }).notNull(),
  bankCode: varchar('bank_code', { length: 50 }).notNull(), // e.g., '058', '044', '057'
  status: bankConnectionStatusEnum('status').notNull().default('pending'),
  sessionId: varchar('session_id', { length: 255 }), // For OTP verification
  accessToken: text('access_token'), // Encrypted
  refreshToken: text('refresh_token'), // Encrypted
  expiresAt: timestamp('expires_at'),
  lastSyncedAt: timestamp('last_synced_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const linkedBankAccounts = pgTable('linked_bank_accounts', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 36 }).notNull(),
  bankCode: varchar('bank_code', { length: 10 }).notNull(), // e.g., '058' for GTBank
  bankName: varchar('bank_name', { length: 100 }).notNull(),
  accountNumber: varchar('account_number', { length: 50 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  accountType: varchar('account_type', { length: 50 }).notNull(), // savings, current, domiciliary
  balance: numeric('balance', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
  status: accountStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const bankTransactions = pgTable('bank_transactions', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: varchar('account_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  transactionId: varchar('transaction_id', { length: 255 }).notNull(), // Bank's transaction ID
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }), // Auto-categorized
  balance: numeric('balance', { precision: 15, scale: 2 }).notNull(), // Balance after transaction
  transactionDate: timestamp('transaction_date').notNull(),
  createdAt: timestamp('created_at').notNull(),
});
