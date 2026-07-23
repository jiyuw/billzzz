import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	updatePayment,
	deletePayment,
	ManualCycleError
} from '$lib/server/db/bill-queries';
import { normalizeDateForStorage } from '$lib/utils/dates';
import { createRequestLogger } from '$lib/server/api-logger';
import { parsePositiveInteger } from '$lib/utils/ids';

class PaymentInputError extends Error {}

function parsePaymentId(value: string): number {
	const id = parsePositiveInteger(value);
	if (id === null) {
		throw new PaymentInputError('Invalid payment ID');
	}
	return id;
}

function buildPaymentUpdate(data: Record<string, unknown>) {
	const updateData: Record<string, unknown> = {};
	if (data.amount !== undefined) {
		const amount = Number(data.amount);
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new PaymentInputError('Payment amount must be greater than zero');
		}
		updateData.amount = amount;
	}
	if (data.paymentDate) {
		try {
			updateData.paymentDate = normalizeDateForStorage(String(data.paymentDate), {
				kind: 'date',
				boundary: 'start'
			});
		} catch {
			throw new PaymentInputError('Invalid payment date');
		}
	}
	if (data.cycleId !== undefined && data.cycleId !== null) {
		const cycleId = parsePositiveInteger(data.cycleId);
		if (cycleId === null) {
			throw new PaymentInputError('Invalid cycle ID');
		}
		updateData.cycleId = cycleId;
	}
	if (data.notes !== undefined) updateData.notes = data.notes;
	return updateData;
}

function paymentMutationError(error: unknown) {
	if (error instanceof PaymentInputError) {
		return json({ error: error.message }, { status: 400 });
	}
	if (error instanceof ManualCycleError && error.code === 'CYCLE_NOT_FOUND') {
		return json({ error: error.message }, { status: 404 });
	}
	return null;
}

export const PUT: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'payment.update');
	try {
		const { params, request } = event;
		const id = parsePaymentId(params.id);
		const data = await request.json();
		logger.info('request', { paymentId: id, body: data });

		const updateData = buildPaymentUpdate(data);

		const payment = await updatePayment(id, updateData as any);

		if (!payment) {
			logger.warn('not_found', { paymentId: id, updateData });
			return json({ error: 'Payment not found' }, { status: 404 });
		}

		logger.audit('success', { paymentId: id, after: payment });
		return json(payment);
	} catch (error) {
		const response = paymentMutationError(error);
		if (response) return response;
		logger.error('error', { paymentId: event.params.id, error });
		return json({ error: 'Failed to update payment' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'payment.patch');
	try {
		const { params, request } = event;
		const id = parsePaymentId(params.id);
		const data = await request.json();
		logger.info('request', { paymentId: id, body: data });

		const updateData = buildPaymentUpdate(data);

		const payment = await updatePayment(id, updateData as any);

		if (!payment) {
			logger.warn('not_found', { paymentId: id, updateData });
			return json({ error: 'Payment not found' }, { status: 404 });
		}

		logger.audit('success', { paymentId: id, after: payment });
		return json(payment);
	} catch (error) {
		const response = paymentMutationError(error);
		if (response) return response;
		logger.error('error', { paymentId: event.params.id, error });
		return json({ error: 'Failed to update payment' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'payment.delete');
	try {
		const { params } = event;
		const id = parsePaymentId(params.id);
		await deletePayment(id);
		logger.audit('success', { paymentId: id });
		return json({ success: true });
	} catch (error) {
		const response = paymentMutationError(error);
		if (response) return response;
		logger.error('error', { paymentId: event.params.id, error });
		return json({ error: 'Failed to delete payment' }, { status: 500 });
	}
};
