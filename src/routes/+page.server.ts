import type { PageServerLoad } from './$types';
import { getAllCategories, getAllPaymentMethods, getAllAssetTags } from '$lib/server/db/queries';
import { getAllBillsWithLatestCycle } from '$lib/server/db/bill-queries';

export const load: PageServerLoad = async () => {
	const bills = await getAllBillsWithLatestCycle();
	const categories = getAllCategories();
	const assetTags = getAllAssetTags();
	const paymentMethods = getAllPaymentMethods();
	const stats = getDashboardStatsFromCycles(bills);

	return {
		bills,
		categories,
		assetTags,
		paymentMethods,
		stats
	};
};

function getDashboardStatsFromCycles(bills: any[]) {
	const isPaid = (bill: any) => {
		const cycle = bill.latestCycle;
		if (!cycle) return false;
		if (bill.isVariable) {
			return cycle.totalPaid > 0 || cycle.isPaid;
		}
		return cycle.isPaid || cycle.totalPaid >= cycle.expectedAmount;
	};

	const totalBills = bills.length;
	const billsWithCycles = bills.filter((bill) => bill.latestCycle);
	const paidBills = billsWithCycles.filter((b) => isPaid(b)).length;
	const unpaidBills = billsWithCycles.length - paidBills;
	return {
		totalBills,
		unpaidBills
	};
}
