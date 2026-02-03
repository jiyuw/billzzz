import { addDays, addWeeks, addMonths, addYears, setDate, getDaysInMonth } from 'date-fns';
import type { RecurrenceUnit } from '$lib/types/bill';

// Re-export shared utility
export { getRecurrenceDescription } from '$lib/utils/recurrence';

/**
 * Calculate the next due date for a recurring bill
 * @param currentDueDate The current due date
 * @param recurrenceInterval The numeric interval for recurrence
 * @param recurrenceUnit The unit of recurrence (day, week, month, year)
 * @param recurrenceDay Optional day of month/year for monthly/yearly bills
 */
export function calculateNextDueDate(
	currentDueDate: Date,
	recurrenceInterval: number,
	recurrenceUnit: RecurrenceUnit,
	recurrenceDay?: number | null
): Date {
	let nextDate: Date;

	switch (recurrenceUnit) {
		case 'day':
			nextDate = addDays(currentDueDate, recurrenceInterval);
			break;
		case 'week':
			nextDate = addWeeks(currentDueDate, recurrenceInterval);
			break;
		case 'month':
			nextDate = addMonths(currentDueDate, recurrenceInterval);
			if (recurrenceDay) {
				const daysInMonth = getDaysInMonth(nextDate);
				const dayToSet = Math.min(recurrenceDay, daysInMonth);
				nextDate = setDate(nextDate, dayToSet);
			}
			break;
		case 'year':
			nextDate = addYears(currentDueDate, recurrenceInterval);
			if (recurrenceDay) {
				const daysInMonth = getDaysInMonth(nextDate);
				const dayToSet = Math.min(recurrenceDay, daysInMonth);
				nextDate = setDate(nextDate, dayToSet);
			}
			break;
		default:
			throw new Error(`Unknown recurrence unit: ${recurrenceUnit}`);
	}

	return nextDate;
}

/**
 * Check if a bill's due date has passed and it needs to be updated
 */
export function shouldUpdateRecurringBill(dueDate: Date, isPaid: boolean): boolean {
	const now = new Date();
	return isPaid && dueDate < now;
}
