import {
	addDays,
	addMonths,
	addWeeks,
	addYears,
	compareAsc,
	startOfDay,
	subDays
} from 'date-fns';
import type { RecurrenceUnit } from '$lib/types/bill';
import { decodeStoredCalendarDate } from '$lib/utils/dates';

export type CycleDateRange = {
	id: number;
	startDate: Date;
	endDate: Date;
};

export type CycleConflict = {
	type: 'gap' | 'overlap';
	leftCycleId: number;
	rightCycleId: number;
};

function sortCycles<T extends CycleDateRange>(cycles: T[]): T[] {
	return [...cycles].sort((left, right) => {
		const byStart = compareAsc(
			decodeStoredCalendarDate(left.startDate),
			decodeStoredCalendarDate(right.startDate)
		);
		return byStart === 0 ? left.id - right.id : byStart;
	});
}

function shiftByFrequency(
	date: Date,
	recurrenceInterval: number,
	recurrenceUnit: RecurrenceUnit
): Date {
	switch (recurrenceUnit) {
		case 'day':
			return addDays(date, recurrenceInterval);
		case 'week':
			return addWeeks(date, recurrenceInterval);
		case 'month':
			return addMonths(date, recurrenceInterval);
		case 'year':
			return addYears(date, recurrenceInterval);
	}
}

function assertValidRange(startDate: Date, endDate: Date): void {
	if (startDate.getTime() > endDate.getTime()) {
		throw new Error('Cycle start date must be on or before end date');
	}
}

export function findCycleConflicts(cycles: CycleDateRange[]): CycleConflict[] {
	const sorted = sortCycles(cycles);
	const conflicts: CycleConflict[] = [];

	for (let index = 1; index < sorted.length; index += 1) {
		const left = sorted[index - 1];
		const right = sorted[index];
		const expectedRightStart = addDays(decodeStoredCalendarDate(left.endDate), 1);
		const actualRightStart = decodeStoredCalendarDate(right.startDate);

		if (actualRightStart.getTime() < expectedRightStart.getTime()) {
			conflicts.push({
				type: 'overlap',
				leftCycleId: left.id,
				rightCycleId: right.id
			});
		} else if (actualRightStart.getTime() > expectedRightStart.getTime()) {
			conflicts.push({
				type: 'gap',
				leftCycleId: left.id,
				rightCycleId: right.id
			});
		}
	}

	return conflicts;
}

export function getLatestCycle<T extends CycleDateRange>(cycles: T[]): T | null {
	return (
		[...cycles].sort((left, right) => {
			const byEnd = compareAsc(
				decodeStoredCalendarDate(right.endDate),
				decodeStoredCalendarDate(left.endDate)
			);
			return byEnd === 0 ? right.id - left.id : byEnd;
		})[0] ?? null
	);
}

export function createCyclePlaceholder(params: {
	cycles: CycleDateRange[];
	isRecurring: boolean;
	recurrenceInterval: number | null | undefined;
	recurrenceUnit: RecurrenceUnit | null | undefined;
	today?: Date;
}): { startDate: Date; endDate: Date } {
	const {
		cycles,
		isRecurring,
		recurrenceInterval,
		recurrenceUnit,
		today = new Date()
	} = params;
	const latest = getLatestCycle(cycles);
	const startDate = latest
		? addDays(decodeStoredCalendarDate(latest.endDate), 1)
		: startOfDay(today);

	if (!isRecurring || !recurrenceInterval || !recurrenceUnit) {
		return { startDate, endDate: startDate };
	}

	return {
		startDate,
		endDate: subDays(shiftByFrequency(startDate, recurrenceInterval, recurrenceUnit), 1)
	};
}

export function getLinkedBoundaryDates(params: {
	side: 'start' | 'end';
	selected: CycleDateRange;
	adjacent: CycleDateRange | null;
	date: Date;
}): {
	current: { startDate: Date; endDate: Date };
	adjacent: { startDate: Date; endDate: Date } | null;
} {
	const { side, selected, adjacent } = params;
	const date = decodeStoredCalendarDate(params.date);
	const selectedStart = decodeStoredCalendarDate(selected.startDate);
	const selectedEnd = decodeStoredCalendarDate(selected.endDate);
	const current =
		side === 'start'
			? { startDate: date, endDate: selectedEnd }
			: { startDate: selectedStart, endDate: date };

	assertValidRange(current.startDate, current.endDate);

	if (!adjacent) {
		return { current, adjacent: null };
	}

	const linkedAdjacent =
		side === 'start'
			? {
					startDate: decodeStoredCalendarDate(adjacent.startDate),
					endDate: subDays(date, 1)
				}
			: {
					startDate: addDays(date, 1),
					endDate: decodeStoredCalendarDate(adjacent.endDate)
				};

	assertValidRange(linkedAdjacent.startDate, linkedAdjacent.endDate);
	return { current, adjacent: linkedAdjacent };
}
