import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizes, stacked, unit } from '../src/layout.ts';

test('three layouts with the agreed sizes', () => {
	assert.deepEqual(sizes, {
		wide: { width: 1920, height: 1080 },
		square: { width: 1080, height: 1080 },
		tall: { width: 1080, height: 1920 }
	});
});

test('only tall stacks the photo above the bars; unit is 1 on a 1080 short side', () => {
	assert.deepEqual([stacked('wide'), stacked('square'), stacked('tall')], [false, false, true]);
	assert.equal(unit('wide'), 1);
	assert.equal(unit('tall'), 1);
});
