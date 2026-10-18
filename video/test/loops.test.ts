import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOOP_FPS, LOOP_FRAMES, loopSize, loops } from '../src/loops/sizes.ts';

test('nine loops, in slide order, matching the deck', () => {
	const deck = [...readFileSync('../src/lib/present/slides.ts', 'utf8').matchAll(/loop: '(\w+)'/g)].map((m) => m[1]);
	assert.deepEqual(loops.map((l) => l.id), deck);
	assert.deepEqual(loops.map((l) => l.id), ['swarm', 'boxes', 'pipeline', 'device', 'sea', 'sound', 'rag', 'coming', 'site']);
});

test('every loop has a banner size and lasts 5 s unless it says otherwise', () => {
	for (const l of loops) assert.ok(loopSize[l.layout], l.id);
	assert.equal(LOOP_FRAMES / LOOP_FPS, 5);
	assert.equal(loops.find((l) => l.id === 'sea')!.frames! / LOOP_FPS, 18); // six real captures, 3 s each
	assert.equal(loops.find((l) => l.id === 'rag')!.frames! / LOOP_FPS, 10); // owner: slower
	assert.equal(loops.find((l) => l.id === 'pipeline')!.frames! / LOOP_FPS, 12); // gaps between photos at the old speed
});

test('illustrations use the real model output for the lab samples', async () => {
	const { seaSamples } = await import('../src/loops/samples.ts');
	const sea = JSON.parse(readFileSync('../src/lib/data/sea-creature-detector.json', 'utf8')) as { samples: { id: string; expected: { label: string; score: number; box: number[] }[] }[] };
	for (const s of seaSamples) {
		const real = sea.samples.find((x) => x.id === s.id)!;
		assert.deepEqual(s.boxes, real.expected.slice(0, 3).map((e) => ({ label: e.label, score: e.score, box: e.box })), s.id);
	}
});

test('the sound loop shows the real output for "Two sounds at once"', async () => {
	const { soundEvents } = await import('../src/loops/samples.ts');
	const snd = JSON.parse(readFileSync('../src/lib/data/sound-detective.json', 'utf8')) as { samples: { id: string; expected: unknown[] }[] };
	assert.deepEqual(soundEvents, snd.samples.find((s) => s.id === 'overlap')!.expected);
});
