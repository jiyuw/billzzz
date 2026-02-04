import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCyclesForBill } from '$lib/server/db/bill-queries';

// GET /api/bills/[id]/cycles
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		if (Number.isNaN(id)) {
			return json({ error: 'Invalid bill ID' }, { status: 400 });
		}

		const cycles = await getCyclesForBill(id);
		return json(cycles);
	} catch (error) {
		console.error('Error fetching bill cycles:', error);
		return json({ error: 'Failed to fetch bill cycles' }, { status: 500 });
	}
};
