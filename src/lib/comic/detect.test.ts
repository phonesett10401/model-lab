import { describe, expect, it } from 'vitest';
import { mergeBoxes, tiles } from './detect';

describe('tiles cover a tall page', () => {
	it('uses one tile for a normal page', () => {
		expect(tiles(1000, 1200)).toEqual([{ x: 0, y: 0, w: 1000, h: 1200 }]);
	});

	it('uses overlapping squares for a tall page', () => {
		const t = tiles(800, 3000);
		expect(t.every((b) => b.w === 800 && b.h === 800 && b.x === 0)).toBe(true);
		expect(t[0].y).toBe(0);
		expect(t.at(-1)!.y + 800).toBe(3000);
		for (let i = 1; i < t.length; i++) expect(t[i - 1].y + 800 - t[i].y).toBeGreaterThanOrEqual(200);
	});
});

describe('edge boxes merge', () => {
	it('joins one bubble cut by a tile edge', () => {
		const out = mergeBoxes([
			{ box: { x: 100, y: 700, w: 200, h: 100 }, cls: 'bubble', score: 0.9, tile: 0 },
			{ box: { x: 100, y: 750, w: 200, h: 120 }, cls: 'bubble', score: 0.7, tile: 1 }
		]);
		expect(out).toEqual([{ box: { x: 100, y: 700, w: 200, h: 170 }, cls: 'bubble', score: 0.9 }]);
	});

	it('keeps different kinds, and boxes from the same tile, apart', () => {
		const two = [
			{ box: { x: 100, y: 700, w: 200, h: 100 }, cls: 'bubble' as const, score: 0.9, tile: 0 },
			{ box: { x: 100, y: 750, w: 200, h: 120 }, cls: 'caption' as const, score: 0.7, tile: 1 }
		];
		expect(mergeBoxes(two)).toHaveLength(2);
		expect(mergeBoxes(two.map((d) => ({ ...d, cls: 'bubble' as const, tile: 0 })))).toHaveLength(2);
	});
});

it('states the real model size', async () => {
	const { statSync } = await import('node:fs');
	const { MODEL_MB, MODEL_URL } = await import('./detect');
	expect(MODEL_MB).toBe(Math.round(statSync(`static${MODEL_URL}`).size / 1e5) / 10);
});

it('drops a box that only wraps two others of the same kind', async () => {
	const { dropContainers } = await import('./detect');
	const a = { box: { x: 900, y: 80, w: 100, h: 50 }, cls: 'bubble' as const, score: 0.9 };
	const b = { box: { x: 1060, y: 120, w: 140, h: 70 }, cls: 'bubble' as const, score: 0.9 };
	const wrap = { box: { x: 890, y: 70, w: 320, h: 130 }, cls: 'bubble' as const, score: 0.6 };
	expect(dropContainers([a, b, wrap])).toEqual([a, b]);
	expect(dropContainers([a, wrap]), 'one box inside is a big bubble with a small one, not a wrapper').toHaveLength(2);
	expect(dropContainers([a, b, { ...wrap, cls: 'caption' as const }]), 'different kind stays').toHaveLength(3);
});

it('keeps one box when two sit on the same text, of any kind', async () => {
	const { dropTwins } = await import('./detect');
	const b = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
	const kept = dropTwins([
		{ box: b(0, 0, 100, 100), cls: 'caption', score: 0.5 },
		{ box: b(5, 5, 100, 95), cls: 'bubble', score: 0.8 },
		{ box: b(2, 0, 98, 100), cls: 'bubble', score: 0.4 },
		{ box: b(200, 0, 100, 100), cls: 'bubble', score: 0.6 }, // a neighbour, kept
		{ box: b(80, 80, 100, 100), cls: 'bubble', score: 0.7 } // overlaps a little, kept
	]);
	expect(kept.map((d) => d.score)).toEqual([0.8, 0.7, 0.6]);
});

it('skips sound effects, even when one sits on a bubble', async () => {
	const { cleanUp } = await import('./detect');
	const b = (x: number, y: number) => ({ x, y, w: 100, h: 100 });
	const kept = cleanUp([
		{ box: b(0, 0), cls: 'sfx', score: 0.9, tile: 0 },
		{ box: b(2, 2), cls: 'bubble', score: 0.6, tile: 0 },
		{ box: b(300, 0), cls: 'sfx', score: 0.8, tile: 0 }
	]);
	expect(kept.map((d) => d.cls)).toEqual(['bubble']);
});
