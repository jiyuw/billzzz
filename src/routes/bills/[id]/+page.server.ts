import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getBillWithCurrentCycle, getCyclesForBill, getPaymentsForBill } from '$lib/server/db/bill-queries';
import { getAllCategories, getAllPaymentMethods } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseInt(params.id);

	if (isNaN(id)) {
		throw error(400, 'Invalid bill ID');
	}

	const billWithCycle = await getBillWithCurrentCycle(id);

	if (!billWithCycle) {
		throw error(404, 'Bill not found');
	}

	const allCycles = await getCyclesForBill(id);
	const payments = await getPaymentsForBill(id);
	const categories = getAllCategories();
	const paymentMethods = getAllPaymentMethods();

	return {
		bill: billWithCycle,
		cycles: allCycles,
		payments,
		categories,
		paymentMethods
	};
};
