import { pgTable, varchar, numeric, integer, timestamp, json, pgEnum } from 'drizzle-orm/pg-core';

export const bnplStatusEnum = pgEnum('bnpl_status', ['pending', 'approved', 'rejected', 'active', 'completed', 'defaulted']);
export const bnplInstallmentStatusEnum = pgEnum('bnpl_installment_status', ['pending', 'paid', 'overdue', 'waived']);

export const bnplApplications = pgTable('bnpl_applications', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 36 }).notNull(),
  studentName: varchar('student_name', { length: 255 }).notNull(),
  schoolName: varchar('school_name', { length: 255 }).notNull(),
  grade: varchar('grade', { length: 50 }).notNull(),
  schoolFeesAmount: numeric('school_fees_amount', { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  installmentPlan: integer('installment_plan').notNull(), // 3, 6, or 12 months
  monthlyPayment: numeric('monthly_payment', { precision: 12, scale: 2 }).notNull(),
  employmentStatus: varchar('employment_status', { length: 100 }).notNull(),
  monthlyIncome: numeric('monthly_income', { precision: 12, scale: 2 }).notNull(),
  documents: json('documents').$type<{
    id: string | null;
    proofOfIncome: string | null;
    studentId: string | null;
  }>().notNull(),
  status: bnplStatusEnum('status').notNull().default('pending'),
  rejectionReason: varchar('rejection_reason', { length: 500 }),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const bnplInstallments = pgTable('bnpl_installments', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  applicationId: varchar('application_id', { length: 36 }).notNull(),
  installmentNumber: integer('installment_number').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp('due_date').notNull(),
  status: bnplInstallmentStatusEnum('status').notNull().default('pending'),
  paidAt: timestamp('paid_at'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  createdAt: timestamp('created_at').notNull(),
});
