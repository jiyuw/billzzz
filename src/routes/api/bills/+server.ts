import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createBill,
	getAllBills,
	getAssetTagById,
	type BillWriteInput
} from '$lib/server/db/queries';
import { createRequestLogger } from '$lib/server/api-logger';

function parseOptionalId(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number.parseInt(String(value), 10);
	return Number.isNaN(parsed) ? null : parsed;
}

// GET /api/bills - Get all bills
export const GET: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bills.list');
	try {
		const { url } = event;
		logger.info('request', { query: Object.fromEntries(url.searchParams.entries()) });

		const status = url.searchParams.get('status') as any;
		const categoryId = url.searchParams.get('categoryId');
		const searchQuery = url.searchParams.get('search');
		const sortField = url.searchParams.get('sortField') as any;
		const sortDirection = url.searchParams.get('sortDirection') as any;

		const filters = {
			status: status || 'all',
			categoryId: categoryId ? parseInt(categoryId) : undefined,
			searchQuery: searchQuery || undefined
		};

		const sort = sortField
			? {
					field: sortField || 'createdAt',
					direction: sortDirection || 'asc'
				}
			: undefined;

		const bills = getAllBills(filters, sort);
		logger.info('success', {
			count: bills.length,
			filters,
			sort
		});
		return json(bills);
	} catch (error) {
		logger.error('error', { error });
		return json({ error: 'Failed to fetch bills' }, { status: 500 });
	}
};

// POST /api/bills - Create a new bill
export const POST: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill.create');
	try {
		const { request } = event;
		const data = await request.json();
		logger.info('request', { body: data });

		// Validate required fields
		if (!data.name || (!data.isVariable && !data.amount)) {
			logger.warn('validation_failed', {
				reason: 'missing_required_fields',
				body: data
			});
			return json({ error: 'Missing required fields' }, { status: 400 });
		}
		if (data.isRecurring && (!data.recurrenceInterval || !data.recurrenceUnit)) {
			logger.warn('validation_failed', {
				reason: 'missing_recurrence_fields',
				body: data
			});
			return json({ error: 'Missing recurrence interval or unit' }, { status: 400 });
		}

		const categoryId = parseOptionalId(data.categoryId);
		const assetTagId = parseOptionalId(data.assetTagId);
		const paymentMethodId = parseOptionalId(data.paymentMethodId);
		const selectedAsset = assetTagId === null ? null : getAssetTagById(assetTagId);

		if (data.isAutopay && paymentMethodId === null) {
			logger.warn('validation_failed', {
				reason: 'autopay_missing_payment_method',
				body: data
			});
			return json({ error: 'Autopay bills must include a payment method' }, { status: 400 });
		}

		const newBill: BillWriteInput = {
			name: data.name,
			amount: data.isVariable ? 0 : parseFloat(data.amount),
			paymentLink: data.paymentLink || null,
			categoryId,
			assetTagId,
			isRecurring: data.isRecurring || false,
			recurrenceInterval: data.recurrenceInterval ? parseInt(data.recurrenceInterval) : null,
			recurrenceUnit: data.recurrenceUnit || null,
			recurrenceDay: null,
			chargeToTenant: selectedAsset?.isRental && data.chargeToTenant === true,
			isPaid: data.isPaid || false,
			isAutopay: data.isAutopay || false,
			paymentMethodId: data.isAutopay ? paymentMethodId : null,
			isVariable: data.isVariable || false,
			notes: data.notes || null
		};

		const bill = createBill(newBill);
		logger.audit('success', {
			billId: bill.id,
			bill
		});
		return json(bill, { status: 201 });
	} catch (error) {
		logger.error('error', { error });
		return json({ error: 'Failed to create bill' }, { status: 500 });
	}
};
