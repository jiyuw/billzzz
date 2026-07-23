import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const billCardSource = await readFile(
	new URL('./BillCard.svelte', import.meta.url),
	'utf8'
);
const cycleSelectorSource = await readFile(
	new URL('./CycleSelector.svelte', import.meta.url),
	'utf8'
);
const detailSource = await readFile(
	new URL('../../routes/bills/[id]/+page.svelte', import.meta.url),
	'utf8'
);
const paymentModalSource = await readFile(
	new URL('./PaymentModal.svelte', import.meta.url),
	'utf8'
);

test('dashboard bill card keeps the original card and action layout', () => {
	assert.match(billCardSource, /rounded-lg/);
	assert.match(billCardSource, />Recent Cycle</);
	assert.match(billCardSource, /title="Add payment"/);
	assert.match(billCardSource, /title="Pay bill"/);
	assert.match(billCardSource, /title="Edit bill"/);
	assert.match(billCardSource, /title="Delete bill"/);
	assert.doesNotMatch(billCardSource, /StatusIndicator/);
	assert.doesNotMatch(billCardSource, /status="paid"/);
});

test('bill detail keeps the original header actions and summary card', () => {
	assert.match(detailSource, /bg-gradient-to-r/);
	assert.match(detailSource, />Add Payment</);
	assert.match(detailSource, />Open Payment Link</);
	assert.match(detailSource, />Edit</);
	assert.match(detailSource, />Delete</);
	assert.match(detailSource, />Most Recent Cycle</);
	assert.ok(
		detailSource.indexOf('>Add Payment<') < detailSource.indexOf('<CycleSelector'),
		'Add Payment should remain in the top bill card'
	);
});

test('detail payment history retains its chart and dropdown viewer', () => {
	assert.match(detailSource, /import LineChart/);
	assert.match(detailSource, /<LineChart/);
	assert.match(detailSource, /Payment History/);
	assert.match(detailSource, /id="historyCycleSelect"/);
	assert.doesNotMatch(detailSource, />Cycle Viewer</);
});

test('cycle selector uses reactive drag preview instead of restoring inline DOM styles', () => {
	assert.match(cycleSelectorSource, /dragPreview/);
	assert.match(cycleSelectorSource, /aria-live="polite"/);
	assert.match(cycleSelectorSource, /pointercancel/);
	assert.doesNotMatch(cycleSelectorSource, /restorePreview/);
	assert.doesNotMatch(cycleSelectorSource, /previewBar\.style/);
});

test('cycle selector, history viewer, and payment modal share one selected cycle', () => {
	assert.doesNotMatch(detailSource, /selectedHistoryCycleId/);
	assert.match(detailSource, /value=\{selectedCycleId/);
	assert.match(detailSource, /onchange=.*selectCycle/);
});

test('dashboard payment modal ignores stale cycle requests between bills', () => {
	assert.match(paymentModalSource, /cycleRequestId/);
	assert.match(paymentModalSource, /availableCycles = \[\]/);
	assert.match(paymentModalSource, /requestId !== cycleRequestId/);
});

test('variable bill without a saved cycle does not render an unpaid cycle state', () => {
	assert.match(billCardSource, /\{#if latestCycle\}[\s\S]*\{#if bill\.isVariable\}/);
	assert.match(billCardSource, /No cycle added/);
});
