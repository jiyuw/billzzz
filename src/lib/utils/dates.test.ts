import assert from 'node:assert/strict';
import test from 'node:test';
import {
	formatStoredDateForInput,
	normalizeDateForStorage,
	parseLocalDate
} from './dates';

function restoreTimezone(timezone: string | undefined) {
	if (timezone === undefined) delete process.env.TZ;
	else process.env.TZ = timezone;
}

test('stored calendar dates preserve legacy UTC-midnight values', () => {
	assert.equal(
		formatStoredDateForInput(new Date(Date.UTC(2026, 6, 12))),
		'2026-07-12'
	);
});

test('stored calendar dates preserve locally normalized end boundaries', () => {
	assert.equal(
		formatStoredDateForInput(new Date(2026, 6, 12, 23, 59, 59, 999)),
		'2026-07-12'
	);
});

test('date-only parsing rejects rollover dates', () => {
	assert.throws(() => parseLocalDate('2026-02-31'), /Invalid date/);
});

test('a date-only value keeps its calendar day across server and browser timezones', () => {
	const originalTimezone = process.env.TZ;

	try {
		process.env.TZ = 'America/Chicago';
		const stored = normalizeDateForStorage('2026-11-17', {
			kind: 'date',
			boundary: 'start'
		});

		process.env.TZ = 'America/Los_Angeles';
		assert.equal(formatStoredDateForInput(stored), '2026-11-17');
	} finally {
		restoreTimezone(originalTimezone);
	}
});

test('an existing server-local date can be normalized before browser display', () => {
	const originalTimezone = process.env.TZ;

	try {
		process.env.TZ = 'America/Chicago';
		const existingStoredDate = new Date(2026, 10, 17, 0, 0, 0, 0);
		const normalized = normalizeDateForStorage(existingStoredDate, {
			kind: 'date',
			boundary: 'start'
		});

		process.env.TZ = 'America/Los_Angeles';
		assert.equal(formatStoredDateForInput(normalized), '2026-11-17');
	} finally {
		restoreTimezone(originalTimezone);
	}
});
