import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOOP_FPS, LOOP_FRAMES, loopSize, loops } from '../src/loops/sizes.ts';

test('nine loops, in slide order, matching the deck', () => {
	const deck = [...readFileSync('../src/lib/present/slides.ts', 'utf8').matchAll(/loop: '(\w+)'/g)].map((m) => m[1]);
	assert.deepEqual(loops.map((l) => l.id), deck);
	assert.deepEqual(loops.map((l) => l.id), ['swarm', 'boxes', 'pipeline', 'device', 'sea', 'sound', 'rag', 'coming', 'site']);
});

test('every loop has a banner size and lasts 5 s', () => {
	for (const l of loops) assert.ok(loopSize[l.layout], l.id);
	assert.equal(LOOP_FRAMES / LOOP_FPS, 5);
});
