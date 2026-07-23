import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const billQueries = readFileSync(new URL('./bill-queries.ts', import.meta.url), 'utf8');
const cycleListRoute = readFileSync(
	new URL('../../../routes/api/bills/[id]/cycles/+server.ts', import.meta.url),
	'utf8'
);

test('cycle reads expose latest saved data without calculation or mutation', () => {
	assert.match(billQueries, /export async function getBillWithLatestCycle/);
	assert.match(billQueries, /export async function getLatestCycleForBill/);
	assert.doesNotMatch(billQueries, /ensureCyclesExist/);
	assert.doesNotMatch(billQueries, /dedupeCyclesForBill/);
	assert.doesNotMatch(billQueries, /bill-cycle-calculator/);
	assert.doesNotMatch(billQueries, /getCurrentCycle/);
	assert.doesNotMatch(billQueries, /getFocusCycleForBill/);
});

test('manual cycle mutations are explicit and boundary updates are transactional', () => {
	assert.match(billQueries, /export async function createManualCycle/);
	assert.match(billQueries, /export async function updateManualCycleBoundary/);
	assert.match(billQueries, /export async function deleteManualCycle/);
	assert.match(billQueries, /db\.transaction/);
	assert.match(billQueries, /Cycle has linked payments/);
});

test('payments require explicit cycles instead of inferring membership from dates', () => {
	assert.doesNotMatch(billQueries, /findCycleForPaymentDate/);
	assert.doesNotMatch(billQueries, /createPayment\(\s*data: Omit<NewBillPayment, 'cycleId'>/);
	assert.match(billQueries, /Cycle not found/);
});

test('cycle collection API supports explicit creation', () => {
	assert.match(cycleListRoute, /export const POST/);
	assert.match(cycleListRoute, /createManualCycle/);
	assert.match(cycleListRoute, /startDate/);
	assert.match(cycleListRoute, /endDate/);
});
