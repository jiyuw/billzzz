import test from 'node:test';
import assert from 'node:assert/strict';

const { getInitialSelectedCycleId, normalizePaymentCycles } = await import(
	new URL('./payment-modal-utils.ts', import.meta.url).href
);

const janCycle = {
	id: 10,
	startDate: new Date('2026-01-01T00:00:00.000Z'),
	endDate: new Date('2026-01-31T00:00:00.000Z'),
	isPaid: true,
	totalPaid: 100
};

const febCycle = {
	id: 20,
	startDate: new Date('2026-02-01T00:00:00.000Z'),
	endDate: new Date('2026-02-28T00:00:00.000Z'),
	isPaid: false,
	totalPaid: 0
};

test('editing a payment keeps its original cycle selection', () => {
	const cycles = normalizePaymentCycles([janCycle, febCycle]);

	const selectedCycleId = getInitialSelectedCycleId({
		cycles,
		existingPaymentCycleId: janCycle.id
	});

	assert.equal(selectedCycleId, janCycle.id);
});

test('new payments prefer the explicitly selected viewer cycle', () => {
	const cycles = normalizePaymentCycles([janCycle, febCycle]);

	const selectedCycleId = getInitialSelectedCycleId({
		cycles,
		selectedCycleId: janCycle.id
	});

	assert.equal(selectedCycleId, janCycle.id);
});

test('new payments fall back to the latest saved cycle', () => {
	const cycles = normalizePaymentCycles([janCycle, febCycle]);

	assert.equal(getInitialSelectedCycleId({ cycles }), febCycle.id);
});

test('latest-cycle fallback uses the greatest id for mixed storage on the same day', () => {
	const cycles = normalizePaymentCycles([
		{
			...febCycle,
			id: 30,
			endDate: new Date(Date.UTC(2026, 6, 31))
		},
		{
			...febCycle,
			id: 20,
			endDate: new Date(2026, 6, 31, 23, 59, 59, 999)
		}
	]);

	assert.equal(getInitialSelectedCycleId({ cycles }), 30);
});
