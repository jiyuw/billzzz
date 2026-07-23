import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePositiveInteger } from './ids';

test('parsePositiveInteger accepts only complete positive safe integers', () => {
	assert.equal(parsePositiveInteger('12'), 12);
	assert.equal(parsePositiveInteger(12), 12);
	assert.equal(parsePositiveInteger('1junk'), null);
	assert.equal(parsePositiveInteger('0'), null);
	assert.equal(parsePositiveInteger(-1), null);
	assert.equal(parsePositiveInteger('1.5'), null);
	assert.equal(parsePositiveInteger(Number.MAX_SAFE_INTEGER + 1), null);
});
