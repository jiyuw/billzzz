import test from 'node:test';
import assert from 'node:assert/strict';

const {
	buildCycleTimeline,
	cycleLane,
	cyclePosition,
	dragBoundaryDate,
	previewCycleBoundary
} = await import(new URL('./cycle-selector-utils.ts', import.meta.url).href);

const localDate = (year: number, month: number, day: number) => new Date(year, month - 1, day);

test('cycleLane alternates any number of cycles across exactly two lanes', () => {
	assert.deepEqual([0, 1, 2, 3, 4].map(cycleLane), [0, 1, 0, 1, 0]);
	assert.equal(cycleLane(101), 1);
});

test('buildCycleTimeline pads saved cycles to full surrounding months', () => {
	const timeline = buildCycleTimeline(
		[
			{
				id: 1,
				startDate: localDate(2026, 2, 10),
				endDate: localDate(2026, 3, 12)
			}
		],
		localDate(2026, 7, 22)
	);

	assert.deepEqual(timeline.startDate, localDate(2026, 2, 1));
	assert.deepEqual(timeline.endDate, localDate(2026, 3, 31));
	assert.equal(timeline.dayCount, 59);
	assert.deepEqual(
		timeline.months.map((month: { label: string; dayCount: number }) => [
			month.label,
			month.dayCount
		]),
		[
			['Feb 2026', 28],
			['Mar 2026', 31]
		]
	);
});

test('buildCycleTimeline shows the current month when there are no cycles', () => {
	const timeline = buildCycleTimeline([], localDate(2026, 7, 22));

	assert.deepEqual(timeline.startDate, localDate(2026, 7, 1));
	assert.deepEqual(timeline.endDate, localDate(2026, 7, 31));
	assert.equal(timeline.dayCount, 31);
});

test('cyclePosition maps inclusive dates to timeline percentages', () => {
	const timeline = buildCycleTimeline(
		[
			{
				id: 1,
				startDate: localDate(2026, 7, 1),
				endDate: localDate(2026, 7, 31)
			}
		],
		localDate(2026, 7, 22)
	);

	assert.deepEqual(
		cyclePosition(
			{
				id: 2,
				startDate: localDate(2026, 7, 8),
				endDate: localDate(2026, 7, 14)
			},
			timeline
		),
		{ left: (7 / 31) * 100, width: (7 / 31) * 100 }
	);
});

test('cyclePosition treats legacy UTC-midnight timestamps as calendar dates', () => {
	const cycle = {
		id: 1,
		startDate: new Date(Date.UTC(2026, 6, 1)),
		endDate: new Date(Date.UTC(2026, 6, 31))
	};
	const timeline = buildCycleTimeline([cycle], localDate(2026, 7, 22));

	assert.deepEqual(timeline.startDate, localDate(2026, 7, 1));
	assert.deepEqual(timeline.endDate, localDate(2026, 7, 31));
	assert.deepEqual(cyclePosition(cycle, timeline), { left: 0, width: 100 });
});

test('previewCycleBoundary moves only the selected boundary', () => {
	const cycle = {
		id: 1,
		startDate: localDate(2026, 7, 1),
		endDate: localDate(2026, 7, 31)
	};

	assert.deepEqual(
		previewCycleBoundary(cycle, 'start', localDate(2026, 7, 8)),
		{
			id: 1,
			startDate: localDate(2026, 7, 8),
			endDate: localDate(2026, 7, 31)
		}
	);
	assert.deepEqual(
		previewCycleBoundary(cycle, 'end', localDate(2026, 7, 24)),
		{
			id: 1,
			startDate: localDate(2026, 7, 1),
			endDate: localDate(2026, 7, 24)
		}
	);
});

test('previewCycleBoundary rejects an inverted cycle range', () => {
	const cycle = {
		id: 1,
		startDate: localDate(2026, 7, 10),
		endDate: localDate(2026, 7, 20)
	};

	assert.equal(
		previewCycleBoundary(cycle, 'start', localDate(2026, 7, 21)),
		null
	);
	assert.equal(
		previewCycleBoundary(cycle, 'end', localDate(2026, 7, 9)),
		null
	);
});

test('dragBoundaryDate preserves the boundary on pointer down and shifts by whole days', () => {
	const boundary = localDate(2026, 7, 20);

	assert.deepEqual(dragBoundaryDate(boundary, 240, 240, 18), boundary);
	assert.deepEqual(
		dragBoundaryDate(boundary, 240, 258, 18),
		localDate(2026, 7, 21)
	);
	assert.deepEqual(
		dragBoundaryDate(boundary, 240, 222, 18),
		localDate(2026, 7, 19)
	);
});
