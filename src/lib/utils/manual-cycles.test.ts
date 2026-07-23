import test from 'node:test';
import assert from 'node:assert/strict';

const {
	createCyclePlaceholder,
	findCycleConflicts,
	getLatestCycle,
	getLinkedBoundaryDates
} = await import(new URL('./manual-cycles.ts', import.meta.url).href);

const localDate = (year: number, month: number, day: number) => new Date(year, month - 1, day);

test('findCycleConflicts reports gaps and overlaps without changing the input order', () => {
	const cycles = [
		{ id: 3, startDate: localDate(2026, 3, 5), endDate: localDate(2026, 3, 31) },
		{ id: 1, startDate: localDate(2026, 1, 1), endDate: localDate(2026, 1, 31) },
		{ id: 2, startDate: localDate(2026, 2, 2), endDate: localDate(2026, 3, 10) }
	];
	const originalIds = cycles.map((cycle) => cycle.id);

	assert.deepEqual(findCycleConflicts(cycles), [
		{ type: 'gap', leftCycleId: 1, rightCycleId: 2 },
		{ type: 'overlap', leftCycleId: 2, rightCycleId: 3 }
	]);
	assert.deepEqual(cycles.map((cycle) => cycle.id), originalIds);
});

test('getLatestCycle uses end date and then id rather than today', () => {
	const latest = getLatestCycle([
		{ id: 1, startDate: localDate(2026, 2, 1), endDate: localDate(2026, 2, 28) },
		{ id: 3, startDate: localDate(2026, 1, 1), endDate: localDate(2026, 3, 31) },
		{ id: 2, startDate: localDate(2026, 3, 1), endDate: localDate(2026, 3, 31) }
	]);

	assert.equal(latest?.id, 3);
});

test('createCyclePlaceholder uses frequency only to seed the range after the latest cycle', () => {
	const placeholder = createCyclePlaceholder({
		cycles: [
			{ id: 1, startDate: localDate(2026, 6, 1), endDate: localDate(2026, 6, 30) }
		],
		isRecurring: true,
		recurrenceInterval: 1,
		recurrenceUnit: 'month',
		today: localDate(2026, 7, 15)
	});

	assert.deepEqual(placeholder, {
		startDate: localDate(2026, 7, 1),
		endDate: localDate(2026, 7, 31)
	});
});

test('createCyclePlaceholder defaults a one-time bill without cycles to one day', () => {
	const today = localDate(2026, 7, 22);

	assert.deepEqual(
		createCyclePlaceholder({
			cycles: [],
			isRecurring: false,
			recurrenceInterval: null,
			recurrenceUnit: null,
			today
		}),
		{ startDate: today, endDate: today }
	);
});

test('getLinkedBoundaryDates moves the next start with the selected end', () => {
	const selected = {
		id: 1,
		startDate: localDate(2026, 6, 1),
		endDate: localDate(2026, 6, 20)
	};
	const next = {
		id: 2,
		startDate: localDate(2026, 6, 21),
		endDate: localDate(2026, 7, 31)
	};

	assert.deepEqual(
		getLinkedBoundaryDates({
			side: 'end',
			selected,
			adjacent: next,
			date: localDate(2026, 6, 30)
		}),
		{
			current: {
				startDate: selected.startDate,
				endDate: localDate(2026, 6, 30)
			},
			adjacent: {
				startDate: localDate(2026, 7, 1),
				endDate: next.endDate
			}
		}
	);
});

test('getLinkedBoundaryDates rejects an edit that consumes the adjacent cycle', () => {
	assert.throws(
		() =>
			getLinkedBoundaryDates({
				side: 'end',
				selected: {
					id: 1,
					startDate: localDate(2026, 6, 1),
					endDate: localDate(2026, 6, 30)
				},
				adjacent: {
					id: 2,
					startDate: localDate(2026, 7, 1),
					endDate: localDate(2026, 7, 5)
				},
				date: localDate(2026, 7, 5)
			}),
		/Cycle start date must be on or before end date/
	);
});
