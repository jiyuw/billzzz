import test from 'node:test';
import assert from 'node:assert/strict';

const {
	createCyclePlaceholder,
	findCycleConflicts,
	getLatestCycle,
	getLinkedBoundaryDates
} = await import(new URL('./manual-cycles.ts', import.meta.url).href);
const { normalizeDateForStorage } = await import(new URL('./dates.ts', import.meta.url).href);

const localDate = (year: number, month: number, day: number) => new Date(year, month - 1, day);

function restoreTimezone(timezone: string | undefined) {
	if (timezone === undefined) delete process.env.TZ;
	else process.env.TZ = timezone;
}

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

test('legacy UTC-midnight boundaries keep their selected calendar days', () => {
	const utcDate = (year: number, month: number, day: number) =>
		new Date(Date.UTC(year, month - 1, day));

	assert.deepEqual(
		getLinkedBoundaryDates({
			side: 'end',
			selected: {
				id: 1,
				startDate: utcDate(2026, 7, 1),
				endDate: utcDate(2026, 7, 31)
			},
			adjacent: {
				id: 2,
				startDate: utcDate(2026, 8, 1),
				endDate: utcDate(2026, 8, 31)
			},
			date: localDate(2026, 7, 20)
		}),
		{
			current: {
				startDate: localDate(2026, 7, 1),
				endDate: localDate(2026, 7, 20)
			},
			adjacent: {
				startDate: localDate(2026, 7, 21),
				endDate: localDate(2026, 8, 31)
			}
		}
	);
});

test('contiguous cycles created by the server do not overlap in a browser timezone', () => {
	const originalTimezone = process.env.TZ;

	try {
		process.env.TZ = 'America/Chicago';
		const cycles = [
			{
				id: 1,
				startDate: normalizeDateForStorage('2026-10-17', {
					kind: 'date',
					boundary: 'start'
				}),
				endDate: normalizeDateForStorage('2026-11-16', {
					kind: 'date',
					boundary: 'end'
				})
			},
			{
				id: 2,
				startDate: normalizeDateForStorage('2026-11-17', {
					kind: 'date',
					boundary: 'start'
				}),
				endDate: normalizeDateForStorage('2026-12-16', {
					kind: 'date',
					boundary: 'end'
				})
			}
		];

		process.env.TZ = 'America/Los_Angeles';
		assert.deepEqual(findCycleConflicts(cycles), []);
	} finally {
		restoreTimezone(originalTimezone);
	}
});

test('contiguous cycle dates remain adjacent across daylight-saving transitions', () => {
	for (const [endDate, nextStartDate] of [
		['2026-03-07', '2026-03-08'],
		['2026-10-31', '2026-11-01']
	]) {
		const leftEnd = new Date(`${endDate}T00:00:00.000Z`);
		const rightStart = new Date(`${nextStartDate}T00:00:00.000Z`);

		assert.deepEqual(
			findCycleConflicts([
				{ id: 1, startDate: new Date('2026-01-01T00:00:00.000Z'), endDate: leftEnd },
				{ id: 2, startDate: rightStart, endDate: new Date('2026-12-31T00:00:00.000Z') }
			]),
			[]
		);
	}
});

test('boundary updates keep the next cycle one calendar day later across DST', () => {
	const updated = getLinkedBoundaryDates({
		side: 'end',
		selected: {
			id: 1,
			startDate: localDate(2026, 2, 1),
			endDate: localDate(2026, 3, 7)
		},
		adjacent: {
			id: 2,
			startDate: localDate(2026, 3, 8),
			endDate: localDate(2026, 3, 31)
		},
		date: localDate(2026, 3, 8)
	});

	assert.deepEqual(updated.adjacent?.startDate, localDate(2026, 3, 9));
});
