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

it('keeps a box that holds two others: round 3 dropping it lost more bubbles than it saved repeats (measured)', async () => {
	const { cleanUp } = await import('./detect');
	const d = (x: number, y: number, w: number, h: number, score: number) => ({ box: { x, y, w, h }, cls: 'bubble' as const, score, tile: 0 });
	expect(cleanUp([d(900, 80, 100, 50, 0.9), d(1060, 120, 140, 70, 0.9), d(890, 70, 320, 130, 0.6)])).toHaveLength(3);
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

it('keeps two overlapping boxes of a bubble chain apart: round 3 finds one box per bubble, the page joins nothing', async () => {
	const { cleanUp } = await import('./detect');
	const b = (x: number, y: number, w: number, h: number, score: number) => ({ box: { x, y, w, h }, cls: 'bubble' as const, score, tile: 0 });
	// "What?!" and "Make you cry?!" (Pepper&Carrot 37, page 5): joined bubbles, boxes overlapping
	const kept = cleanUp([b(134, 1174, 138, 59, 0.8), b(220, 1225, 176, 120, 0.7), b(331, 1322, 197, 148, 0.7)]);
	expect(kept).toHaveLength(3);
	// "…well, what are you waiting for?" over "Try to make me cry.": two joined bubbles of about the same width, stacked
	expect(cleanUp([b(560, 300, 200, 90, 0.8), b(570, 370, 190, 80, 0.7)])).toHaveLength(2);
});

it('reads the round 3 model: its four classes, free text kept, sound effects dropped', async () => {
	const { CLASSES, cleanUp } = await import('./detect');
	expect(CLASSES).toEqual(['bubble', 'caption', 'free-text', 'sfx']);
	const b = (x: number) => ({ x, y: 0, w: 100, h: 60 });
	const kept = cleanUp([2, 3, 0].map((k, i) => ({ box: b(200 * i), cls: CLASSES[k], score: 0.9, tile: 0 })));
	expect(kept.map((d) => d.cls).sort()).toEqual(['bubble', 'free-text']);
});
