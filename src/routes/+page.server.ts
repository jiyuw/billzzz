import type { PageServerLoad } from './$types';
import { getAllCategories, getAllPaymentMethods, getAllAssetTags, getPaydaySettings } from '$lib/server/db/queries';
import { getAllBillsWithCurrentCycle } from '$lib/server/db/bill-queries';
import { calculateNextPayday, calculateFollowingPayday } from '$lib/server/utils/payday';
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
	const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
	const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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
	const upcomingBills = bills.filter(
		(b) => !isPaid(b) && getDueDate(b) > now && getDueDate(b) <= sevenDaysFromNow
	).length;

	const totalAmount = bills
		.filter((b) => !isPaid(b) && getDueDate(b) <= thirtyDaysFromNow)
		.reduce((sum, b) => sum + b.amount, 0);

	const paydayConfig = getPaydaySettings();
	let nextPayday: Date | null = null;
	let followingPayday: Date | null = null;
	let dueBeforeNextPayday = 0;
	let amountDueBeforeNextPayday = 0;
	let dueBeforeFollowingPayday = 0;
	let amountDueBeforeFollowingPayday = 0;

	if (paydayConfig) {
		try {
			nextPayday = calculateNextPayday(paydayConfig, now);
			followingPayday = calculateFollowingPayday(paydayConfig, now);

			const billsBeforeNextPayday = bills.filter(
				(b) => !isPaid(b) && getDueDate(b) <= nextPayday!
			);
			dueBeforeNextPayday = billsBeforeNextPayday.length;
			amountDueBeforeNextPayday = billsBeforeNextPayday.reduce((sum, b) => sum + b.amount, 0);

			const billsBeforeFollowingPayday = bills.filter(
				(b) => !isPaid(b) && getDueDate(b) <= followingPayday!
			);
			dueBeforeFollowingPayday = billsBeforeFollowingPayday.length;
			amountDueBeforeFollowingPayday = billsBeforeFollowingPayday.reduce((sum, b) => sum + b.amount, 0);
		} catch (error) {
			console.error('Error calculating payday stats:', error);
		}
	}

	return {
		totalBills,
		paidBills,
		unpaidBills,
		overdueBills,
		upcomingBills,
		totalAmount,
		nextPayday,
		followingPayday,
		dueBeforeNextPayday,
		amountDueBeforeNextPayday,
		dueBeforeFollowingPayday,
		amountDueBeforeFollowingPayday,
		hasPaydayConfigured: paydayConfig !== undefined
	};
}
