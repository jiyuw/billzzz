import type { RecurrenceUnit } from '$lib/types/bill';
import type { Bill } from '../db/schema';
import {
	addDays,
	addWeeks,
	addMonths,
	addYears,
	startOfDay,
	endOfDay,
	isBefore,
	isAfter,
	isWithinInterval
} from 'date-fns';

/**
 * Calculate the cycle dates for a bill based on recurrence pattern and due date
 * For non-recurring bills, creates a single cycle from creation to due date
 */
export function calculateBillCycleDates(
	bill: Bill,
	referenceDate: Date = new Date()
): { startDate: Date; endDate: Date } {
	// For non-recurring bills, create a single cycle
	if (!bill.isRecurring || !bill.recurrenceUnit || !bill.recurrenceInterval) {
		return {
			startDate: startOfDay(bill.createdAt),
			endDate: endOfDay(bill.dueDate)
		};
	}

	const dueDate = startOfDay(bill.dueDate);
	const ref = startOfDay(referenceDate);

	// Cycles should start the day after the due date, so the due date is the cycle end.
	let cycleStart = addDays(dueDate, 1);

	// Move forward from due date to find the cycle containing the reference date
	while (isBefore(getCycleEnd(bill.recurrenceUnit, bill.recurrenceInterval, cycleStart), ref)) {
		cycleStart = getNextCycleStart(bill.recurrenceUnit, bill.recurrenceInterval, cycleStart);
	}

	// Move backward if we've gone too far
	while (isAfter(cycleStart, ref)) {
		cycleStart = getPreviousCycleStart(bill.recurrenceUnit, bill.recurrenceInterval, cycleStart);
	}

	const cycleEnd = getCycleEnd(bill.recurrenceUnit, bill.recurrenceInterval, cycleStart);

	return {
		startDate: cycleStart,
		endDate: cycleEnd
	};
}

/**
 * Get the end date of a cycle given its start date
 */
function getCycleEnd(recurrenceUnit: RecurrenceUnit, recurrenceInterval: number, cycleStart: Date): Date {
	let end: Date;

	switch (recurrenceUnit) {
		case 'day':
			end = addDays(cycleStart, recurrenceInterval);
			break;
		case 'week':
			end = addWeeks(cycleStart, recurrenceInterval);
			break;
		case 'month':
			end = addMonths(cycleStart, recurrenceInterval);
			break;
		case 'year':
			end = addYears(cycleStart, recurrenceInterval);
			break;
	}

	// End of day before the next cycle starts
	return endOfDay(addDays(end, -1));
}

/**
 * Get the start date of the next cycle
 */
function getNextCycleStart(recurrenceUnit: RecurrenceUnit, recurrenceInterval: number, currentStart: Date): Date {
	switch (recurrenceUnit) {
		case 'day':
			return addDays(currentStart, recurrenceInterval);
		case 'week':
			return addWeeks(currentStart, recurrenceInterval);
		case 'month':
			return addMonths(currentStart, recurrenceInterval);
		case 'year':
			return addYears(currentStart, recurrenceInterval);
	}
}

/**
 * Get the start date of the previous cycle
 */
function getPreviousCycleStart(recurrenceUnit: RecurrenceUnit, recurrenceInterval: number, currentStart: Date): Date {
	switch (recurrenceUnit) {
		case 'day':
			return addDays(currentStart, -recurrenceInterval);
		case 'week':
			return addWeeks(currentStart, -recurrenceInterval);
		case 'month':
			return addMonths(currentStart, -recurrenceInterval);
		case 'year':
			return addYears(currentStart, -recurrenceInterval);
	}
}

/**
 * Find which cycle a payment date belongs to
 */
export function findCycleForPaymentDate(
	bill: Bill,
	paymentDate: Date
): { startDate: Date; endDate: Date } {
	return calculateBillCycleDates(bill, paymentDate);
}

/**
 * Generate all cycles between two dates for a bill
 */
export function generateBillCyclesBetween(
	bill: Bill,
	startDate: Date,
	endDate: Date
): Array<{ startDate: Date; endDate: Date }> {
	// For non-recurring bills, return single cycle
	if (!bill.isRecurring || !bill.recurrenceUnit || !bill.recurrenceInterval) {
		return [{
			startDate: startOfDay(bill.createdAt),
			endDate: endOfDay(bill.dueDate)
		}];
	}

	const cycles: Array<{ startDate: Date; endDate: Date }> = [];
	let currentCycle = calculateBillCycleDates(bill, startDate);

	while (isBefore(currentCycle.startDate, endDate) || currentCycle.startDate.getTime() === endDate.getTime()) {
		cycles.push({ ...currentCycle });
		currentCycle = calculateBillCycleDates(
			bill,
			getNextCycleStart(bill.recurrenceUnit!, bill.recurrenceInterval!, currentCycle.startDate)
		);
	}

	return cycles;
}

/**
 * Check if a date is within a cycle
 */
export function isDateInCycle(
	date: Date,
	cycleStart: Date,
	cycleEnd: Date
): boolean {
	return isWithinInterval(date, { start: cycleStart, end: cycleEnd });
}
