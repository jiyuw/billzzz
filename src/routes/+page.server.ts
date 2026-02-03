import type { PageServerLoad } from './$types';
import { getAllCategories, getDashboardStats, getAllPaymentMethods } from '$lib/server/db/queries';
import { getAllBillsWithCurrentCycle } from '$lib/server/db/bill-queries';

export const load: PageServerLoad = async () => {
	const bills = await getAllBillsWithCurrentCycle();
	const categories = getAllCategories();
	const paymentMethods = getAllPaymentMethods();
	const stats = getDashboardStats();

	return {
		bills,
		categories,
		paymentMethods,
		stats
	};
};
