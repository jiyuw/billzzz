import type { Bill, Category, BillCycle, BillPayment } from '$lib/server/db/schema';

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

export type BillStatus = 'paid' | 'upcoming' | 'overdue';

// Extended bill type with category details
export interface BillWithCategory extends Bill {
	category?: Category | null;
	assetTag?: {
		id: number;
		name: string;
		type?: 'house' | 'vehicle' | null;
		isRental?: boolean;
		color?: string | null;
		bannerPattern?: 'solid' | 'stripes' | 'dots' | 'crosshatch' | null;
	} | null;
}

// Bill cycle with computed fields
export interface BillCycleWithComputed extends BillCycle {
	remaining: number;
	percentPaid: number;
}

export interface BillUsageStats {
	count: number;
	average: number;
	min: number;
	max: number;
	lastAmount: number;
}

// Bill with its latest saved cycle for presentation only
export interface BillWithLatestCycle extends Bill {
	latestCycle?: BillCycleWithComputed | null;
	usageStats?: BillUsageStats | null;
	category?: Category | null;
	assetTag?: {
		id: number;
		name: string;
		type?: 'house' | 'vehicle' | null;
		isRental?: boolean;
		color?: string | null;
		bannerPattern?: 'solid' | 'stripes' | 'dots' | 'crosshatch' | null;
	} | null;
	paymentMethod?: { id: number; nickname: string; lastFour: string } | null;
}

export type BillWithCycle = BillWithLatestCycle;

// Filter options for bills list
export interface BillFilters {
	status?: 'all' | 'paid' | 'unpaid';
	categoryId?: number | null;
	searchQuery?: string;
}

// Sort options for bills list
export interface BillSort {
	field: 'amount' | 'name' | 'createdAt';
	direction: 'asc' | 'desc';
}

// Form data for creating/editing bills
export interface BillFormData {
	name: string;
	amount: number;
	paymentLink?: string;
	categoryId?: number | null;
	assetTagId?: number | null;
	isRecurring: boolean;
	recurrenceInterval?: number;
	recurrenceUnit?: RecurrenceUnit;
	isAutopay: boolean;
	paymentMethodId?: number | null;
	isVariable?: boolean;
	chargeToTenant?: boolean;
	notes?: string;
}

// Category form data
export interface CategoryFormData {
	name: string;
	color: string;
	icon?: string;
}

// Export database types
export type { Bill, Category, BillCycle, BillPayment };
