import {
	differenceInCalendarDays,
	eachMonthOfInterval,
	endOfMonth,
	format,
	startOfDay,
	startOfMonth
} from 'date-fns';

type CycleRange = {
	id: number;
	startDate: Date;
	endDate: Date;
};

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
			? new Date(Math.min(...cycles.map((cycle) => cycle.startDate.getTime())))
			: today;
	const rawEnd =
		cycles.length > 0
			? new Date(Math.max(...cycles.map((cycle) => cycle.endDate.getTime())))
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
	const leftDays = differenceInCalendarDays(startOfDay(cycle.startDate), timeline.startDate);
	const cycleDays =
		differenceInCalendarDays(startOfDay(cycle.endDate), startOfDay(cycle.startDate)) + 1;

	return {
		left: (leftDays / timeline.dayCount) * 100,
		width: (cycleDays / timeline.dayCount) * 100
	};
}
