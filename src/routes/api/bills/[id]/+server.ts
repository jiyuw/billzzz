import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getBillById,
	updateBill,
	deleteBill,
	getAssetTagById
} from '$lib/server/db/queries';
import { createRequestLogger } from '$lib/server/api-logger';

function parseOptionalId(value: unknown): number | null | undefined {
	if (value === undefined) return undefined;
	if (value === null || value === '') return null;
	const parsed = Number.parseInt(String(value), 10);
	return Number.isNaN(parsed) ? null : parsed;
}

// GET /api/bills/[id] - Get a single bill
export const GET: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill.get');
	try {
		const { params } = event;
		const id = parseInt(params.id);
		const bill = getBillById(id);

		if (!bill) {
			logger.warn('not_found', { billId: id });
			return json({ error: 'Bill not found' }, { status: 404 });
		}

		logger.info('success', { billId: id });
		return json(bill);
	} catch (error) {
		logger.error('error', { billId: event.params.id, error });
		return json({ error: 'Failed to fetch bill' }, { status: 500 });
	}
};

// PUT /api/bills/[id] - Update a bill
export const PUT: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill.update');
	try {
		const { params, request } = event;
		const id = parseInt(params.id);
		const data = await request.json();
		logger.info('request', {
			billId: id,
			body: data
		});
		const existingBill = getBillById(id);
		if (!existingBill) {
			logger.warn('not_found', { billId: id, body: data });
			return json({ error: 'Bill not found' }, { status: 404 });
		}
		const categoryId = parseOptionalId(data.categoryId);
		const assetTagId = parseOptionalId(data.assetTagId);
		const paymentMethodId = parseOptionalId(data.paymentMethodId);
		const selectedAssetId = assetTagId !== undefined ? assetTagId : existingBill.assetTagId;
		const selectedAsset =
			selectedAssetId === null || selectedAssetId === undefined
				? null
				: getAssetTagById(selectedAssetId);
		const shouldNormalizeChargeToTenant =
			data.chargeToTenant !== undefined || assetTagId !== undefined;
		const requestedChargeToTenant =
			data.chargeToTenant === undefined ? existingBill.chargeToTenant : data.chargeToTenant === true;

		if (data.isAutopay === true && paymentMethodId === null) {
			logger.warn('validation_failed', {
				billId: id,
				reason: 'autopay_missing_payment_method',
				body: data
			});
			return json({ error: 'Autopay bills must include a payment method' }, { status: 400 });
		}

		const updateData: any = {
			name: data.name,
			amount: data.amount ? parseFloat(data.amount) : undefined,
			paymentLink: data.paymentLink,
			categoryId,
			assetTagId,
			isRecurring: data.isRecurring,
			recurrenceInterval: data.recurrenceInterval ? parseInt(data.recurrenceInterval) : undefined,
			recurrenceUnit: data.recurrenceUnit,
			recurrenceDay: null,
			isPaid: data.isPaid,
			isAutopay: data.isAutopay,
			paymentMethodId,
			isVariable: data.isVariable,
			notes: data.notes
		};
		if (shouldNormalizeChargeToTenant) {
			updateData.chargeToTenant = selectedAsset?.isRental && requestedChargeToTenant;
		}
		if (data.isRecurring === false) {
			updateData.recurrenceInterval = null;
			updateData.recurrenceUnit = null;
			updateData.recurrenceDay = null;
		}
		if (data.isAutopay === false) {
			updateData.paymentMethodId = null;
		}

		// Remove undefined values
		Object.keys(updateData).forEach(
			(key) => updateData[key] === undefined && delete updateData[key]
		);

		const recurrenceChanged =
			(updateData.isRecurring !== undefined && updateData.isRecurring !== existingBill.isRecurring) ||
			(updateData.recurrenceInterval !== undefined &&
				updateData.recurrenceInterval !== existingBill.recurrenceInterval) ||
			(updateData.recurrenceUnit !== undefined &&
				updateData.recurrenceUnit !== existingBill.recurrenceUnit);

		const bill = updateBill(id, updateData);
		if (!bill) {
			logger.warn('not_found_after_update', { billId: id, updateData });
			return json({ error: 'Bill not found' }, { status: 404 });
		}

		logger.audit('success', {
			billId: id,
			before: existingBill,
			after: bill,
			recurrenceChanged,
			bill
		});
		return json(bill);
	} catch (error) {
		logger.error('error', {
			billId: event.params.id,
			error
		});
		return json({ error: 'Failed to update bill' }, { status: 500 });
	}
};

// DELETE /api/bills/[id] - Delete a bill
export const DELETE: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill.delete');
	try {
		const { params } = event;
		const id = parseInt(params.id);
		logger.info('request', { billId: id });
		const bill = deleteBill(id);

		if (!bill) {
			logger.warn('not_found', { billId: id });
			return json({ error: 'Bill not found' }, { status: 404 });
		}

		logger.audit('success', { billId: id, deleted: bill });
		return json({ success: true });
	} catch (error) {
		logger.error('error', { billId: event.params.id, error });
		return json({ error: 'Failed to delete bill' }, { status: 500 });
	}
};
