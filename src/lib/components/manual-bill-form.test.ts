import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync(new URL('./BillForm.svelte', import.meta.url), 'utf8');
const createApi = readFileSync(
	new URL('../../routes/api/bills/+server.ts', import.meta.url),
	'utf8'
);
const updateApi = readFileSync(
	new URL('../../routes/api/bills/[id]/+server.ts', import.meta.url),
	'utf8'
);

test('bill form asks for frequency but no cycle or due dates', () => {
	assert.match(form, /recurrenceInterval/);
	assert.match(form, /recurrenceUnit/);
	assert.doesNotMatch(form, /id="dueDate"/);
	assert.doesNotMatch(form, /id="cycleStartDate"/);
	assert.doesNotMatch(form, /id="cycleEndDate"/);
	assert.doesNotMatch(form, /Cycle Recalculation/);
});

test('bill APIs do not require date fields or rebuild cycles', () => {
	assert.doesNotMatch(createApi, /!data\.dueDate/);
	assert.doesNotMatch(createApi, /cycleStartDate/);
	assert.doesNotMatch(updateApi, /rebuildCurrentAndFutureCycles/);
	assert.doesNotMatch(updateApi, /parsedDueDate/);
});
