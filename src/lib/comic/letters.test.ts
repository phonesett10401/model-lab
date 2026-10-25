import { expect, it } from 'vitest';
import { inpaint, letterPixels } from './letters';

/** A 120×60 box painted row by row by `paint(y)`, with letter strokes (3 px bars, 10 px apart) across rows 22–37. */
function box(paint: (y: number) => number[], ink: number[]) {
	const w = 120, h = 60, px = new Uint8ClampedArray(w * h * 4), isLetter = new Uint8Array(w * h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const i = y * w + x;
			isLetter[i] = x >= 20 && x < 100 && y >= 22 && y < 38 && (x % 10 < 3 || y === 22 || y === 37) ? 1 : 0;
			px.set([...(isLetter[i] ? ink : paint(y)), 255], i * 4);
		}
	return { px, w, h, isLetter, all: new Uint8Array(w * h).fill(1) };
}

const far = (isLetter: Uint8Array, w: number, i: number) => {
	const x = i % w, y = (i / w) | 0;
	for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (isLetter[(y + dy) * w + x + dx]) return false;
	return true;
};

it('finds dark letters on light paper and light letters on a dark box', () => {
	for (const [paper, ink] of [[[250, 248, 240], [10, 10, 10]], [[30, 30, 40], [240, 240, 240]]]) {
		const { px, w, h, isLetter, all } = box(() => paper, ink);
		const m = letterPixels(px, w, h, all);
		for (let i = 0; i < w * h; i++) {
			if (isLetter[i]) expect(m[i], `letter ${i}`).toBe(1);
			else if (far(isLetter, w, i)) expect(m[i], `paper ${i}`).toBe(0);
		}
	}
});

it('finds light letters on a dark box', () => {
	const { px, w, h, isLetter, all } = box(() => [20, 40, 90], [255, 255, 200]);
	const m = letterPixels(px, w, h, all);
	expect(m[30 * w + 30]).toBe(1);
	expect(m[30 * w + 35]).toBe(isLetter[30 * w + 35]);
	expect(m[5 * w + 60]).toBe(0);
});

it('stays inside the area it is given', () => {
	const { px, w, h } = box(() => [250, 250, 250], [0, 0, 0]);
	const area = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) area[i] = i % w < 60 ? 1 : 0;
	const m = letterPixels(px, w, h, area);
	expect(m[30 * w + 70]).toBe(0);
	expect(m[30 * w + 30]).toBe(1);
});

it('inpainting fills a flat box with its paper colour', () => {
	const { px, w, h, all } = box(() => [250, 235, 190], [0, 0, 0]);
	const hole = letterPixels(px, w, h, all);
	inpaint(px, w, h, hole);
	for (let i = 0; i < w * h; i++)
		for (let c = 0; c < 3; c++) expect(Math.abs(px[i * 4 + c] - [250, 235, 190][c]), `pixel ${i}`).toBeLessThanOrEqual(2);
});

it('inpainting continues a gradient', () => {
	const paint = (y: number) => [255 - y, 255 - y, 255];
	const { px, w, h, all } = box(paint, [0, 0, 0]);
	const hole = letterPixels(px, w, h, all);
	inpaint(px, w, h, hole);
	for (let i = 0; i < w * h; i++) if (hole[i]) expect(Math.abs(px[i * 4] - paint((i / w) | 0)[0]), `pixel ${i}`).toBeLessThanOrEqual(6);
});

it('inpainting never changes a pixel outside the hole', () => {
	const { px, w, h } = box((y) => [200 - y, 100 + y, 50], [0, 0, 0]);
	const hole = new Uint8Array(w * h);
	for (let y = 25; y < 35; y++) for (let x = 30; x < 50; x++) hole[y * w + x] = 1;
	const before = px.slice();
	inpaint(px, w, h, hole);
	for (let i = 0; i < w * h; i++) if (!hole[i]) for (let c = 0; c < 4; c++) expect(px[i * 4 + c]).toBe(before[i * 4 + c]);
	expect(px[(30 * w + 40) * 4]).not.toBe(0); // and the hole is filled
});
