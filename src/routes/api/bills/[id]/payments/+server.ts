import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPaymentsForBill, createPayment } from '$lib/server/db/bill-queries';
import { formatDateForInput, normalizeDateForStorage } from '$lib/utils/dates';
import { createRequestLogger } from '$lib/server/api-logger';

export const GET: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill_payments.list');
	try {
		const { params } = event;
		const id = parseInt(params.id);
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
		const id = parseInt(params.id);
		const data = await request.json();
		logger.info('request', { billId: id, body: data });
		const cycleId = Number.parseInt(String(data.cycleId), 10);
		if (Number.isNaN(cycleId)) {
			return json({ error: 'A saved cycle is required' }, { status: 400 });
		}

		const payment = await createPayment({
			billId: id,
			cycleId,
			amount: parseFloat(data.amount),
			paymentDate: data.paymentDate
				? normalizeDateForStorage(data.paymentDate, { kind: 'date', boundary: 'start' })
				: normalizeDateForStorage(formatDateForInput(new Date()), { kind: 'date', boundary: 'start' }),
			notes: data.notes
		});

		logger.audit('success', { billId: id, paymentId: payment.id, payment });
		return json(payment, { status: 201 });
	} catch (error) {
		logger.error('error', { billId: event.params.id, error });
		return json({ error: 'Failed to create payment' }, { status: 500 });
	}
};
