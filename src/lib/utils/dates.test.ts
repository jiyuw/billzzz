import assert from 'node:assert/strict';
import test from 'node:test';
import { formatStoredDateForInput, parseLocalDate } from './dates';

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
