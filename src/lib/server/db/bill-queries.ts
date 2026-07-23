import { db } from './index';
import { billCycles, billPayments } from './schema';
import type { BillCycle, BillPayment, NewBillPayment } from './schema';
import type {
	BillCycleWithComputed,
	BillUsageStats,
	BillWithLatestCycle
} from '$lib/types/bill';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { endOfDay, startOfDay } from 'date-fns';
import { getLinkedBoundaryDates } from '$lib/utils/manual-cycles';

export class ManualCycleError extends Error {
	constructor(
		message: string,
		public readonly code:
			| 'BILL_NOT_FOUND'
			| 'CYCLE_NOT_FOUND'
			| 'INVALID_RANGE'
			| 'NOT_CONTIGUOUS'
			| 'HAS_PAYMENTS'
			| 'MIDDLE_DELETE'
	) {
		super(message);
	}
}

function addComputedFields(cycle: BillCycle): BillCycleWithComputed {
	const remaining = Math.max(cycle.expectedAmount - cycle.totalPaid, 0);
	const percentPaid =
		cycle.expectedAmount > 0
			? Math.min((cycle.totalPaid / cycle.expectedAmount) * 100, 100)
			: 0;

	return {
		...cycle,
		remaining,
		percentPaid
	};
}

async function getBillUsageStats(
	billId: number,
	windowSize = 6
): Promise<BillUsageStats | null> {
	const cycles = await db
		.select({ totalPaid: billCycles.totalPaid })
		.from(billCycles)
		.where(and(eq(billCycles.billId, billId), sql`${billCycles.totalPaid} > 0`))
		.orderBy(desc(billCycles.endDate), desc(billCycles.id))
		.limit(windowSize);

	if (cycles.length === 0) return null;

	const amounts = cycles.map((cycle) => cycle.totalPaid);
	const total = amounts.reduce((sum, amount) => sum + amount, 0);

	return {
		count: amounts.length,
		average: total / amounts.length,
		min: Math.min(...amounts),
		max: Math.max(...amounts),
		lastAmount: amounts[0]
	};
}

export async function getLatestCycleForBill(
	billId: number
): Promise<BillCycle | undefined> {
	const result = await db
		.select()
		.from(billCycles)
		.where(eq(billCycles.billId, billId))
		.orderBy(desc(billCycles.endDate), desc(billCycles.id))
		.limit(1);

	return result[0];
}

export async function getBillWithLatestCycle(
	id: number
): Promise<BillWithLatestCycle | undefined> {
	const { getBillById } = await import('./queries');
	const bill = getBillById(id);
	if (!bill) return undefined;

	const latestCycle = await getLatestCycleForBill(id);
	const usageStats = bill.isVariable ? await getBillUsageStats(id) : null;

	return {
		...bill,
		latestCycle: latestCycle ? addComputedFields(latestCycle) : null,
		usageStats
	};
}

export async function getAllBillsWithLatestCycle(): Promise<BillWithLatestCycle[]> {
	const { getAllBills } = await import('./queries');
	const allBills = getAllBills();

	return Promise.all(
		allBills.map(async (bill) => {
			const latestCycle = await getLatestCycleForBill(bill.id);
			const usageStats = bill.isVariable ? await getBillUsageStats(bill.id) : null;

			return {
				...bill,
				latestCycle: latestCycle ? addComputedFields(latestCycle) : null,
				usageStats
			};
		})
	);
}

export async function getCyclesForBill(billId: number): Promise<BillCycle[]> {
	return db
		.select()
		.from(billCycles)
		.where(eq(billCycles.billId, billId))
		.orderBy(desc(billCycles.endDate), desc(billCycles.id));
}

export async function createManualCycle(
	billId: number,
	input: { startDate: Date; endDate: Date }
): Promise<BillCycle> {
	const { getBillById } = await import('./queries');
	const bill = getBillById(billId);
	if (!bill) throw new ManualCycleError('Bill not found', 'BILL_NOT_FOUND');

	const startDate = startOfDay(input.startDate);
	const endDate = endOfDay(input.endDate);
	if (startDate.getTime() > endDate.getTime()) {
		throw new ManualCycleError(
			'Cycle start date must be on or before end date',
			'INVALID_RANGE'
		);
	}

	const latest = await getLatestCycleForBill(billId);
	if (latest) {
		const expectedStart = startOfDay(latest.endDate);
		expectedStart.setDate(expectedStart.getDate() + 1);
		if (startDate.getTime() !== expectedStart.getTime()) {
			throw new ManualCycleError(
				'New cycles must start the day after the latest cycle',
				'NOT_CONTIGUOUS'
			);
		}
	}

	const inserted = await db
		.insert(billCycles)
		.values({
			billId,
			startDate,
			endDate,
			dueDate: null,
			expectedAmount: bill.amount,
			totalPaid: 0,
			isPaid: false
		})
		.returning();

	return inserted[0];
}

export async function updateManualCycleBoundary(
	billId: number,
	cycleId: number,
	side: 'start' | 'end',
	date: Date
): Promise<BillCycle[]> {
	try {
		db.transaction((tx) => {
			const cycles = tx
				.select()
				.from(billCycles)
				.where(eq(billCycles.billId, billId))
				.orderBy(asc(billCycles.startDate), asc(billCycles.id))
				.all();
			const selectedIndex = cycles.findIndex((cycle) => cycle.id === cycleId);

			if (selectedIndex === -1) {
				throw new ManualCycleError('Cycle not found', 'CYCLE_NOT_FOUND');
			}

			const selected = cycles[selectedIndex];
			const adjacent =
				side === 'start' ? cycles[selectedIndex - 1] ?? null : cycles[selectedIndex + 1] ?? null;
			const linked = getLinkedBoundaryDates({
				side,
				selected,
				adjacent,
				date
			});

			tx.update(billCycles)
				.set({
					startDate: startOfDay(linked.current.startDate),
					endDate: endOfDay(linked.current.endDate),
					updatedAt: new Date()
				})
				.where(and(eq(billCycles.id, cycleId), eq(billCycles.billId, billId)))
				.run();

			if (adjacent && linked.adjacent) {
				tx.update(billCycles)
					.set({
						startDate: startOfDay(linked.adjacent.startDate),
						endDate: endOfDay(linked.adjacent.endDate),
						updatedAt: new Date()
					})
					.where(and(eq(billCycles.id, adjacent.id), eq(billCycles.billId, billId)))
					.run();
			}
		});
	} catch (error) {
		if (error instanceof ManualCycleError) throw error;
		if (error instanceof Error && /start date must be/i.test(error.message)) {
			throw new ManualCycleError(error.message, 'INVALID_RANGE');
		}
		throw error;
	}

	return getCyclesForBill(billId);
}

export async function deleteManualCycle(
	billId: number,
	cycleId: number
): Promise<void> {
	const cycles = await db
		.select()
		.from(billCycles)
		.where(eq(billCycles.billId, billId))
		.orderBy(asc(billCycles.startDate), asc(billCycles.id));
	const cycleIndex = cycles.findIndex((cycle) => cycle.id === cycleId);
	if (cycleIndex === -1) {
		throw new ManualCycleError('Cycle not found', 'CYCLE_NOT_FOUND');
	}

	const linkedPayments = await db
		.select({ id: billPayments.id })
		.from(billPayments)
		.where(and(eq(billPayments.billId, billId), eq(billPayments.cycleId, cycleId)))
		.limit(1);
	if (linkedPayments.length > 0) {
		throw new ManualCycleError('Cycle has linked payments', 'HAS_PAYMENTS');
	}

	if (cycleIndex > 0 && cycleIndex < cycles.length - 1) {
		throw new ManualCycleError(
			'Only the first or latest cycle can be deleted',
			'MIDDLE_DELETE'
		);
	}

	await db
		.delete(billCycles)
		.where(and(eq(billCycles.id, cycleId), eq(billCycles.billId, billId)));
}

async function recalculateCycle(cycleId: number): Promise<void> {
	const cycle = await db
		.select()
		.from(billCycles)
		.where(eq(billCycles.id, cycleId))
		.limit(1);
	if (!cycle[0]) return;

	const { getBillById } = await import('./queries');
	const bill = getBillById(cycle[0].billId);
	if (!bill) return;

	const payments = await getPaymentsForCycle(cycleId);
	const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
	const isPaid = bill.isVariable
		? totalPaid > 0
		: totalPaid >= cycle[0].expectedAmount;

	await db
		.update(billCycles)
		.set({ totalPaid, isPaid, updatedAt: new Date() })
		.where(eq(billCycles.id, cycleId));
}

export async function createPayment(data: NewBillPayment): Promise<BillPayment> {
	const cycle = await db
		.select({ id: billCycles.id })
		.from(billCycles)
		.where(and(eq(billCycles.id, data.cycleId), eq(billCycles.billId, data.billId)))
		.limit(1);
	if (!cycle[0]) throw new Error('Cycle not found');

	const inserted = await db.insert(billPayments).values(data).returning();
	await recalculateCycle(data.cycleId);
	return inserted[0];
}

export async function createPaymentForCycle(
	data: Omit<NewBillPayment, 'cycleId'>,
	cycleId: number
): Promise<BillPayment> {
	return createPayment({ ...data, cycleId });
}

export async function updatePayment(
	id: number,
	data: Partial<NewBillPayment>
): Promise<BillPayment | undefined> {
	const existing = await db
		.select()
		.from(billPayments)
		.where(eq(billPayments.id, id))
		.limit(1);
	if (!existing[0]) return undefined;

	const nextCycleId = data.cycleId ?? existing[0].cycleId;
	const selectedCycle = await db
		.select({ id: billCycles.id })
		.from(billCycles)
		.where(
			and(
				eq(billCycles.id, nextCycleId),
				eq(billCycles.billId, existing[0].billId)
			)
		)
		.limit(1);
	if (!selectedCycle[0]) throw new Error('Cycle not found');

	const updated = await db
		.update(billPayments)
		.set({ ...data, cycleId: nextCycleId, updatedAt: new Date() })
		.where(eq(billPayments.id, id))
		.returning();

	await recalculateCycle(existing[0].cycleId);
	if (nextCycleId !== existing[0].cycleId) {
		await recalculateCycle(nextCycleId);
	}

	return updated[0];
}

export async function deletePayment(id: number): Promise<void> {
	const payment = await db
		.select()
		.from(billPayments)
		.where(eq(billPayments.id, id))
		.limit(1);
	if (!payment[0]) return;

	await db.delete(billPayments).where(eq(billPayments.id, id));
	await recalculateCycle(payment[0].cycleId);
}

export async function getPaymentsForBill(billId: number): Promise<BillPayment[]> {
	return db
		.select()
		.from(billPayments)
		.where(eq(billPayments.billId, billId))
		.orderBy(desc(billPayments.paymentDate), desc(billPayments.id));
}

export async function getPaymentsForCycle(cycleId: number): Promise<BillPayment[]> {
	return db
		.select()
		.from(billPayments)
		.where(eq(billPayments.cycleId, cycleId))
		.orderBy(desc(billPayments.paymentDate), desc(billPayments.id));
}
