import type { PageServerLoad } from './$types';
import { getAllCategories, getAllPaymentMethods, getAllAssetTags } from '$lib/server/db/queries';
import { getAllBillsWithCurrentCycle } from '$lib/server/db/bill-queries';
import { endOfDay } from 'date-fns';

export const load: PageServerLoad = async () => {
	const bills = await getAllBillsWithCurrentCycle();
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
	const now = new Date();
	const getDueDate = (bill: any) => endOfDay(bill.focusCycle?.endDate ?? bill.dueDate);
	const isPaid = (bill: any) => {
		const cycle = bill.focusCycle ?? bill.currentCycle;
		if (!cycle) return false;
		if (bill.isVariable) {
			return cycle.totalPaid > 0 || cycle.isPaid;
		}
		return cycle.isPaid || cycle.totalPaid >= cycle.expectedAmount;
	};

	const totalBills = bills.length;
	const paidBills = bills.filter((b) => isPaid(b)).length;
	const unpaidBills = totalBills - paidBills;
	const overdueBills = bills.filter((b) => !isPaid(b) && getDueDate(b) <= now).length;
	return {
		totalBills,
		unpaidBills,
		overdueBills
	};
}
