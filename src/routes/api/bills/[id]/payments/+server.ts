import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getPaymentsForBill,
	createPayment,
	ManualCycleError
} from '$lib/server/db/bill-queries';
import { formatDateForInput, normalizeDateForStorage } from '$lib/utils/dates';
import { createRequestLogger } from '$lib/server/api-logger';
import { parsePositiveInteger } from '$lib/utils/ids';

export const GET: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill_payments.list');
	try {
		const { params } = event;
		const id = parsePositiveInteger(params.id);
		if (id === null) {
			return json({ error: 'Invalid bill ID' }, { status: 400 });
		}
		const payments = await getPaymentsForBill(id);
		logger.info('success', { billId: id, count: payments.length });
		return json(payments);
	} catch (error) {
		logger.error('error', { billId: event.params.id, error });
		return json({ error: 'Failed to fetch payments' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill_payment.create');
	try {
		const { params, request } = event;
		const id = parsePositiveInteger(params.id);
		const data = await request.json();
		logger.info('request', { billId: id, body: data });
		const cycleId = parsePositiveInteger(data.cycleId);
		const amount = Number(data.amount);
		if (id === null) {
			return json({ error: 'Invalid bill ID' }, { status: 400 });
		}
		if (cycleId === null) {
			return json({ error: 'A saved cycle is required' }, { status: 400 });
		}
		if (!Number.isFinite(amount) || amount <= 0) {
			return json({ error: 'Payment amount must be greater than zero' }, { status: 400 });
		}

		let paymentDate: Date;
		try {
			paymentDate = normalizeDateForStorage(
				data.paymentDate || formatDateForInput(new Date()),
				{ kind: 'date', boundary: 'start' }
			);
		} catch {
			return json({ error: 'Invalid payment date' }, { status: 400 });
		}

		const payment = await createPayment({
			billId: id,
			cycleId,
			amount,
			paymentDate,
			notes: data.notes
		});

		logger.audit('success', { billId: id, paymentId: payment.id, payment });
		return json(payment, { status: 201 });
	} catch (error) {
		if (error instanceof ManualCycleError && error.code === 'CYCLE_NOT_FOUND') {
			return json({ error: error.message }, { status: 404 });
		}
		logger.error('error', { billId: event.params.id, error });
		return json({ error: 'Failed to create payment' }, { status: 500 });
	}
};
