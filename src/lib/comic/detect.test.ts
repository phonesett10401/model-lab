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
