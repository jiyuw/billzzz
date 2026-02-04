import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const categories = sqliteTable('categories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	color: text('color').notNull(),
	icon: text('icon'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const assetTags = sqliteTable('asset_tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	type: text('type', { enum: ['house', 'vehicle'] }),
	color: text('color'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const paymentMethods = sqliteTable('payment_methods', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	nickname: text('nickname').notNull(),
	lastFour: text('last_four').notNull(),
	type: text('type', { enum: ['credit_card', 'checking', 'savings'] }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const bills = sqliteTable('bills', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	amount: real('amount').notNull(),
	dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
	paymentLink: text('payment_link'),
	categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
	assetTagId: integer('asset_tag_id').references(() => assetTags.id, { onDelete: 'set null' }),
	paymentMethodId: integer('payment_method_id').references(() => paymentMethods.id, { onDelete: 'set null' }),
	isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
	recurrenceType: text('recurrence_type', {
		enum: ['weekly', 'biweekly', 'bimonthly', 'monthly', 'quarterly', 'yearly']
	}),
	recurrenceInterval: integer('recurrence_interval'),
	recurrenceUnit: text('recurrence_unit', {
		enum: ['day', 'week', 'month', 'year']
	}),
	recurrenceDay: integer('recurrence_day'),
	isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(false),
	isAutopay: integer('is_autopay', { mode: 'boolean' }).notNull().default(false),
	isVariable: integer('is_variable', { mode: 'boolean' }).notNull().default(false),
	notes: text('notes'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Bill cycles - generated periods for tracking billing periods
export const billCycles = sqliteTable('bill_cycles', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	billId: integer('bill_id')
		.notNull()
		.references(() => bills.id, { onDelete: 'cascade' }),
	startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
	endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
	expectedAmount: real('expected_amount').notNull(), // Snapshot of bill amount when cycle created
	totalPaid: real('total_paid').notNull().default(0),
	isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Bill payments - payment transactions within billing cycles
export const billPayments = sqliteTable('bill_payments', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	billId: integer('bill_id')
		.notNull()
		.references(() => bills.id, { onDelete: 'cascade' }),
	cycleId: integer('cycle_id')
		.notNull()
		.references(() => billCycles.id, { onDelete: 'cascade' }),
	amount: real('amount').notNull(),
	paymentDate: integer('payment_date', { mode: 'timestamp' }).notNull(),
	notes: text('notes'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Type exports for use in application
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type AssetTag = typeof assetTags.$inferSelect;
export type NewAssetTag = typeof assetTags.$inferInsert;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;

export type BillCycle = typeof billCycles.$inferSelect;
export type NewBillCycle = typeof billCycles.$inferInsert;

export type BillPayment = typeof billPayments.$inferSelect;
export type NewBillPayment = typeof billPayments.$inferInsert;

// User preferences - stores app settings like theme preference
export const userPreferences = sqliteTable('user_preferences', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	themePreference: text('theme_preference', { enum: ['light', 'dark', 'system'] })
		.notNull()
		.default('system'),
	expectedIncomeAmount: real('expected_income_amount'), // Expected income per paycheck for forecasting
	currentBalance: real('current_balance'), // Current account balance for cash flow projection
	lastBalanceUpdate: integer('last_balance_update', { mode: 'timestamp' }), // When balance was last updated
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
