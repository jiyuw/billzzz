import {
	addDays,
	differenceInCalendarDays,
	eachMonthOfInterval,
	endOfMonth,
	format,
	startOfDay,
	startOfMonth
} from 'date-fns';
import { decodeStoredCalendarDate } from '$lib/utils/dates';

type CycleRange = {
	id: number;
	startDate: Date;
	endDate: Date;
};

export type CycleBoundary = 'start' | 'end';

export type CycleTimeline = {
	startDate: Date;
	endDate: Date;
	dayCount: number;
	months: Array<{
		label: string;
		startIndex: number;
		dayCount: number;
	}>;
};

export function buildCycleTimeline(
	cycles: CycleRange[],
	today = new Date()
): CycleTimeline {
	const rawStart =
		cycles.length > 0
			? new Date(
					Math.min(
						...cycles.map((cycle) =>
							decodeStoredCalendarDate(cycle.startDate).getTime()
						)
					)
				)
			: today;
	const rawEnd =
		cycles.length > 0
			? new Date(
					Math.max(
						...cycles.map((cycle) =>
							decodeStoredCalendarDate(cycle.endDate).getTime()
						)
					)
				)
			: today;
	const startDate = startOfMonth(rawStart);
	const endDate = startOfDay(endOfMonth(rawEnd));
	const dayCount = differenceInCalendarDays(endDate, startDate) + 1;
	const months = eachMonthOfInterval({ start: startDate, end: endDate }).map(
		(month) => {
			const monthEnd = endOfMonth(month);
			return {
				label: format(month, 'MMM yyyy'),
				startIndex: differenceInCalendarDays(month, startDate),
				dayCount: differenceInCalendarDays(monthEnd, month) + 1
			};
		}
	);

	return { startDate, endDate, dayCount, months };
}

export function cyclePosition(
	cycle: CycleRange,
	timeline: CycleTimeline
): { left: number; width: number } {
	const startDate = decodeStoredCalendarDate(cycle.startDate);
	const endDate = decodeStoredCalendarDate(cycle.endDate);
	const leftDays = differenceInCalendarDays(startDate, timeline.startDate);
	const cycleDays =
		differenceInCalendarDays(endDate, startDate) + 1;

	return {
		left: (leftDays / timeline.dayCount) * 100,
		width: (cycleDays / timeline.dayCount) * 100
	};
}

export function dragBoundaryDate(
	boundaryDate: Date,
	originClientX: number,
	clientX: number,
	dayWidth: number
): Date {
	if (dayWidth <= 0) return decodeStoredCalendarDate(boundaryDate);
	const dayDelta = Math.round((clientX - originClientX) / dayWidth);
	return addDays(decodeStoredCalendarDate(boundaryDate), dayDelta);
}

export function previewCycleBoundary(
	cycle: CycleRange,
	side: CycleBoundary,
	date: Date
): CycleRange | null {
	const startDate =
		side === 'start' ? startOfDay(date) : decodeStoredCalendarDate(cycle.startDate);
	const endDate =
		side === 'end' ? startOfDay(date) : decodeStoredCalendarDate(cycle.endDate);

	if (startDate > endDate) return null;
	return { id: cycle.id, startDate, endDate };
}
