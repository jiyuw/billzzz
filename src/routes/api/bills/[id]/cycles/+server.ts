import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createManualCycle,
	getCyclesForBill,
	ManualCycleError
} from '$lib/server/db/bill-queries';
import { createRequestLogger } from '$lib/server/api-logger';
import { normalizeDateForStorage } from '$lib/utils/dates';

// GET /api/bills/[id]/cycles
export const GET: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill_cycles.list');
	try {
		const { params } = event;
		const id = parseInt(params.id);
		if (Number.isNaN(id)) {
			logger.warn('validation_failed', { reason: 'invalid_bill_id', billId: params.id });
			return json({ error: 'Invalid bill ID' }, { status: 400 });
		}

		const cycles = await getCyclesForBill(id);
		logger.info('success', { billId: id, count: cycles.length });
		return json(cycles);
	} catch (error) {
		logger.error('error', { billId: event.params.id, error });
		return json({ error: 'Failed to fetch bill cycles' }, { status: 500 });
	}
};

// POST /api/bills/[id]/cycles
export const POST: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill_cycles.create');
	try {
		const billId = Number.parseInt(event.params.id, 10);
		if (Number.isNaN(billId)) {
			return json({ error: 'Invalid bill ID' }, { status: 400 });
		}

		const data = await event.request.json();
		if (!data.startDate || !data.endDate) {
			return json({ error: 'Cycle start and end dates are required' }, { status: 400 });
		}

		const startDate = normalizeDateForStorage(data.startDate, {
			kind: 'date',
			boundary: 'start'
		});
		const endDate = normalizeDateForStorage(data.endDate, {
			kind: 'date',
			boundary: 'end'
		});
		const cycle = await createManualCycle(billId, { startDate, endDate });
		const cycles = await getCyclesForBill(billId);

		logger.audit('success', { billId, cycleId: cycle.id });
		return json({ cycle, cycles }, { status: 201 });
	} catch (error) {
		if (error instanceof ManualCycleError) {
			const status = error.code === 'BILL_NOT_FOUND' ? 404 : 409;
			return json({ error: error.message }, { status });
		}
		logger.error('error', { billId: event.params.id, error });
		return json({ error: 'Failed to create bill cycle' }, { status: 500 });
	}
};
