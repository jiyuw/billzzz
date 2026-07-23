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
	assert.doesNotMatch(billCardSource, /min-h-\[28px\]/);
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

test('detail restores standalone cycle viewer and keeps payment history chart-only', () => {
	assert.match(detailSource, /import LineChart/);
	assert.match(detailSource, /<LineChart/);
	assert.match(detailSource, /Payment History/);
	assert.match(detailSource, />\s*Cycle Viewer\s*</);
	assert.match(detailSource, /Linked Payments/);
	assert.match(detailSource, /No payment/);
	assert.doesNotMatch(detailSource, /historyCycleSelect/);
	assert.doesNotMatch(detailSource, /historyStats/);
	assert.doesNotMatch(detailSource, />Avg</);
	assert.doesNotMatch(detailSource, /\{#if historyChartPoints\.length > 0\}/);
	assert.ok(
		detailSource.indexOf('<CycleSelector') < detailSource.indexOf('Cycle Viewer') &&
			detailSource.indexOf('Cycle Viewer') < detailSource.indexOf('Payment History'),
		'standalone Cycle Viewer should sit between selector and Payment History'
	);
});

test('linked payments keep date inline and use colored icon actions', () => {
	assert.match(detailSource, /Pencil/);
	assert.match(detailSource, /Trash2/);
	assert.match(detailSource, /text-blue-600/);
	assert.match(detailSource, /text-red-600/);
	assert.match(detailSource, /rounded-2xl border[^"]*px-3 py-2/);
	assert.match(detailSource, /size="xs"/);
	assert.doesNotMatch(
		detailSource,
		/<\/p>\s*<p[^>]*>\s*\{formatStoredDate\(payment\.paymentDate\)\}/
	);
});

test('cycle selector renders drag date as an in-timeline tooltip without layout shift', () => {
	assert.match(cycleSelectorSource, /dragPreview/);
	assert.match(cycleSelectorSource, /aria-live="polite"/);
	assert.match(cycleSelectorSource, /pointerPercent/);
	assert.match(cycleSelectorSource, /absolute.*z-/);
	assert.match(cycleSelectorSource, /import \{ Plus, Trash2 \}/);
	assert.match(cycleSelectorSource, /pointercancel/);
	assert.doesNotMatch(cycleSelectorSource, /class="mt-4 text-sm font-medium text-blue-700/);
	assert.doesNotMatch(cycleSelectorSource, /restorePreview/);
	assert.doesNotMatch(cycleSelectorSource, /previewBar\.style/);
});

test('cycle selector uses two lanes and stronger selected color', () => {
	assert.match(cycleSelectorSource, /cycleLane\(index\)/);
	assert.match(cycleSelectorSource, /data-cycle-lane=/);
	assert.match(cycleSelectorSource, /h-24/);
	assert.match(cycleSelectorSource, /bg-blue-100 text-blue-800 hover:bg-blue-200/);
	assert.match(cycleSelectorSource, /bg-blue-700 text-white/);
	assert.doesNotMatch(cycleSelectorSource, /space-y-2/);
});

test('cycle selector exposes icon-only confirmed cycle deletion', () => {
	assert.match(cycleSelectorSource, /Trash2/);
	assert.match(cycleSelectorSource, /aria-label="Delete selected cycle"/);
	assert.match(cycleSelectorSource, /title="Delete cycle"/);
	assert.match(cycleSelectorSource, /onDelete\(selectedCycle\.id\)/);
	assert.match(detailSource, /async function deleteCycle/);
	assert.match(detailSource, /confirm\(/);
	assert.match(
		detailSource,
		/method:\s*'DELETE'/
	);
	assert.match(detailSource, /onDelete=\{deleteCycle\}/);
});

test('cycle selector, standalone viewer, and payment modal share one selected cycle', () => {
	assert.doesNotMatch(detailSource, /selectedHistoryCycleId/);
	assert.match(detailSource, /const selectedCycle = \$derived/);
	assert.match(detailSource, /selectedPayments/);
	assert.match(detailSource, /\{selectedCycleId\}/);
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
