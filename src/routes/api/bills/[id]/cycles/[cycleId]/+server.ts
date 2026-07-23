import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteManualCycle,
	getCyclesForBill,
	ManualCycleError,
	updateManualCycleBoundary
} from '$lib/server/db/bill-queries';
import { createRequestLogger } from '$lib/server/api-logger';
import { normalizeDateForStorage } from '$lib/utils/dates';
import { parsePositiveInteger } from '$lib/utils/ids';

class CycleInputError extends Error {}

function parseBoundaryDate(value: unknown, boundary: 'start' | 'end') {
	try {
		return normalizeDateForStorage(String(value), { kind: 'date', boundary });
	} catch {
		throw new CycleInputError(`Invalid cycle ${boundary} date`);
	}
}

function parseIds(params: { id: string; cycleId: string }) {
	return {
		billId: parsePositiveInteger(params.id),
		cycleId: parsePositiveInteger(params.cycleId)
	};
}

function manualCycleError(error: ManualCycleError) {
	const status =
		error.code === 'BILL_NOT_FOUND' || error.code === 'CYCLE_NOT_FOUND' ? 404 : 409;
	return json({ error: error.message }, { status });
}

export const PUT: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill_cycles.update_boundary');
	try {
		const { billId, cycleId } = parseIds(event.params);
		if (billId === null || cycleId === null) {
			return json({ error: 'Invalid bill or cycle ID' }, { status: 400 });
		}

		const data = await event.request.json();
		if ((data.side !== 'start' && data.side !== 'end') || !data.date) {
			return json({ error: 'Boundary side and date are required' }, { status: 400 });
		}

		const date = parseBoundaryDate(data.date, data.side);
		const cycles = await updateManualCycleBoundary(
			billId,
			cycleId,
			data.side,
			date
		);

		logger.audit('success', { billId, cycleId, side: data.side, date });
		return json({ cycles });
	} catch (error) {
		if (error instanceof CycleInputError) {
			return json({ error: error.message }, { status: 400 });
		}
		if (error instanceof ManualCycleError) return manualCycleError(error);
		logger.error('error', { billId: event.params.id, cycleId: event.params.cycleId, error });
		return json({ error: 'Failed to update bill cycle' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const logger = createRequestLogger(event, 'bill_cycles.delete');
	try {
		const { billId, cycleId } = parseIds(event.params);
		if (billId === null || cycleId === null) {
			return json({ error: 'Invalid bill or cycle ID' }, { status: 400 });
		}

		await deleteManualCycle(billId, cycleId);
		const cycles = await getCyclesForBill(billId);
		logger.audit('success', { billId, cycleId });
		return json({ cycles });
	} catch (error) {
		if (error instanceof ManualCycleError) return manualCycleError(error);
		logger.error('error', { billId: event.params.id, cycleId: event.params.cycleId, error });
		return json({ error: 'Failed to delete bill cycle' }, { status: 500 });
	}
};
