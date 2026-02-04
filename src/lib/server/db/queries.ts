import { db } from './index';
import {
	bills,
	categories,
	paymentMethods,
	assetTags,
	type NewBill,
	type NewCategory,
	type Category,
	type NewPaymentMethod,
	type PaymentMethod,
	type NewAssetTag,
	type AssetTag
} from './schema';
import { eq, and, gte, lte, desc, asc, like, or } from 'drizzle-orm';
import type { BillFilters, BillSort } from '$lib/types/bill';

// ===== CATEGORY QUERIES =====

export function getAllCategories(): Category[] {
	return db.select().from(categories).orderBy(categories.name).all();
}

export function getCategoryById(id: number) {
	return db.select().from(categories).where(eq(categories.id, id)).get();
}

export function createCategory(data: NewCategory) {
	return db.insert(categories).values(data).returning().get();
}

export function updateCategory(id: number, data: Partial<NewCategory>) {
	return db.update(categories).set(data).where(eq(categories.id, id)).returning().get();
}

export function deleteCategory(id: number) {
	return db.delete(categories).where(eq(categories.id, id)).returning().get();
}

// ===== ASSET TAG QUERIES =====

export function getAllAssetTags(): AssetTag[] {
	return db.select().from(assetTags).orderBy(assetTags.name).all();
}

export function getAssetTagById(id: number) {
	return db.select().from(assetTags).where(eq(assetTags.id, id)).get();
}

export function createAssetTag(data: NewAssetTag) {
	return db.insert(assetTags).values(data).returning().get();
}

export function updateAssetTag(id: number, data: Partial<NewAssetTag>) {
	return db
		.update(assetTags)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(assetTags.id, id))
		.returning()
		.get();
}

export function deleteAssetTag(id: number) {
	return db.delete(assetTags).where(eq(assetTags.id, id)).returning().get();
}

// ===== PAYMENT METHOD QUERIES =====

export function getAllPaymentMethods(): PaymentMethod[] {
	return db.select().from(paymentMethods).orderBy(paymentMethods.nickname).all();
}

export function getPaymentMethodById(id: number) {
	return db.select().from(paymentMethods).where(eq(paymentMethods.id, id)).get();
}

export function createPaymentMethod(data: NewPaymentMethod) {
	return db.insert(paymentMethods).values(data).returning().get();
}

export function updatePaymentMethod(id: number, data: Partial<NewPaymentMethod>) {
	return db
		.update(paymentMethods)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(paymentMethods.id, id))
		.returning()
		.get();
}

export function deletePaymentMethod(id: number) {
	return db.delete(paymentMethods).where(eq(paymentMethods.id, id)).returning().get();
}

// ===== BILL QUERIES =====

export function getAllBills(filters?: BillFilters, sort?: BillSort) {
	let query = db
		.select({
			id: bills.id,
			name: bills.name,
			amount: bills.amount,
			dueDate: bills.dueDate,
			paymentLink: bills.paymentLink,
			categoryId: bills.categoryId,
			assetTagId: bills.assetTagId,
			paymentMethodId: bills.paymentMethodId,
			isRecurring: bills.isRecurring,
			recurrenceType: bills.recurrenceType,
			recurrenceInterval: bills.recurrenceInterval,
			recurrenceUnit: bills.recurrenceUnit,
			recurrenceDay: bills.recurrenceDay,
			isPaid: bills.isPaid,
			isAutopay: bills.isAutopay,
			isVariable: bills.isVariable,
			notes: bills.notes,
			createdAt: bills.createdAt,
			updatedAt: bills.updatedAt,
			category: categories,
			assetTag: assetTags
		})
		.from(bills)
		.leftJoin(categories, eq(bills.categoryId, categories.id))
		.leftJoin(assetTags, eq(bills.assetTagId, assetTags.id));

	// Apply filters
	const conditions = [];

	if (filters?.status && filters.status !== 'all') {
		const now = new Date();

		if (filters.status === 'paid') {
			conditions.push(eq(bills.isPaid, true));
		} else if (filters.status === 'unpaid') {
			conditions.push(eq(bills.isPaid, false));
		} else if (filters.status === 'overdue') {
			conditions.push(
				and(
					eq(bills.isPaid, false),
					lte(bills.dueDate, now)
				)
			);
		} else if (filters.status === 'upcoming') {
			const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
			conditions.push(
				and(
					eq(bills.isPaid, false),
					gte(bills.dueDate, now),
					lte(bills.dueDate, sevenDaysFromNow)
				)
			);
		}
	}

	if (filters?.categoryId) {
		conditions.push(eq(bills.categoryId, filters.categoryId));
	}

	if (filters?.searchQuery) {
		conditions.push(
			or(
				like(bills.name, `%${filters.searchQuery}%`),
				like(bills.notes, `%${filters.searchQuery}%`)
			)
		);
	}

	if (conditions.length > 0) {
		query = query.where(and(...conditions)) as any;
	}

	// Apply sorting
	if (sort) {
		const column = bills[sort.field];
		const direction = sort.direction === 'asc' ? asc : desc;
		query = query.orderBy(direction(column)) as any;
	} else {
		// Default sort by due date ascending
		query = query.orderBy(asc(bills.dueDate)) as any;
	}

	return query.all();
}

export function getBillById(id: number) {
	return db
		.select({
			id: bills.id,
			name: bills.name,
			amount: bills.amount,
			dueDate: bills.dueDate,
			paymentLink: bills.paymentLink,
			categoryId: bills.categoryId,
			assetTagId: bills.assetTagId,
			paymentMethodId: bills.paymentMethodId,
			isRecurring: bills.isRecurring,
			recurrenceType: bills.recurrenceType,
			recurrenceInterval: bills.recurrenceInterval,
			recurrenceUnit: bills.recurrenceUnit,
			recurrenceDay: bills.recurrenceDay,
			isPaid: bills.isPaid,
			isAutopay: bills.isAutopay,
			isVariable: bills.isVariable,
			notes: bills.notes,
			createdAt: bills.createdAt,
			updatedAt: bills.updatedAt,
			category: categories,
			assetTag: assetTags,
			paymentMethod: paymentMethods
		})
		.from(bills)
		.leftJoin(categories, eq(bills.categoryId, categories.id))
		.leftJoin(assetTags, eq(bills.assetTagId, assetTags.id))
		.leftJoin(paymentMethods, eq(bills.paymentMethodId, paymentMethods.id))
		.where(eq(bills.id, id))
		.get();
}

export function createBill(data: NewBill) {
	return db.insert(bills).values(data).returning().get();
}

export function updateBill(id: number, data: Partial<NewBill>) {
	return db
		.update(bills)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(bills.id, id))
		.returning()
		.get();
}

export function deleteBill(id: number) {
	// Delete the bill (payment_history will cascade delete automatically)
	return db.delete(bills).where(eq(bills.id, id)).returning().get();
}

export function markBillAsPaid(id: number, paid: boolean) {
	return db
		.update(bills)
		.set({
			isPaid: paid,
			updatedAt: new Date()
		})
		.where(eq(bills.id, id))
		.returning()
		.get();
}
