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

it('with enclosed set, strokes reaching the area edge are the outline, not letters', () => {
	// A bubble's area (a rectangle) on white with dark marks: a letter in the middle, and a band along the area's bottom
	// edge (the outline's inner edge, as found on a real page where the bubble's own outline came out as "letters").
	const w = 60, h = 40, px = new Uint8ClampedArray(w * h * 4).fill(255), area = new Uint8Array(w * h);
	for (let y = 5; y < 35; y++) for (let x = 5; x < 55; x++) area[y * w + x] = 1;
	const dark = (x0: number, x1: number, y0: number, y1: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.set([0, 0, 0, 255], (y * w + x) * 4); };
	dark(20, 30, 15, 20);
	dark(10, 50, 32, 35);
	const { hole, outline } = letterPixels(px, w, h, area, true);
	expect(hole[17 * w + 25]).toBe(1);
	expect(hole[33 * w + 30]).toBe(0);
	expect(outline[33 * w + 30]).toBe(1);
});

it('with the paper colour given, the middle of a big bold letter is erased too', () => {
	// A caption's inside on white with one bold stroke 60 px thick: in its middle the commonest colour around is black,
	// so without the paper colour that black passed as background and stayed as a blot (the "ZHUGE YI" caption).
	const w = 120, h = 100, px = new Uint8ClampedArray(w * h * 4).fill(255), area = new Uint8Array(w * h).fill(1);
	for (let y = 20; y < 80; y++) for (let x = 30; x < 90; x++) px.set([0, 0, 0, 255], (y * w + x) * 4);
	expect(letterPixels(px, w, h, area, true).hole[50 * w + 60]).toBe(0); // the old blot
	const { hole } = letterPixels(px, w, h, area, true, [255, 255, 255]);
	for (let y = 20; y < 80; y++) for (let x = 30; x < 90; x++) expect(hole[y * w + x]).toBe(1);
	expect(hole[5 * w + 5]).toBe(0); // the paper stays
});

it('on a see-through bubble, erases the letters in the word boxes with their white outline, and nothing else', async () => {
	const { wordLetters } = await import('./letters');
	// Screentone dots (every other pixel dark) over the art, a black letter bar with a white outline inside a word box,
	// and a dark art blob outside any word box.
	const w = 80, h = 40, px = new Uint8ClampedArray(w * h * 4);
	for (let i = 0; i < w * h; i++) {
		const x = i % w, y = (i / w) | 0;
		const v = x >= 10 && x < 14 && y >= 10 && y < 30 ? 0 : x >= 7 && x < 17 && y >= 7 && y < 33 ? 255 : x >= 50 && x < 60 && y >= 10 && y < 30 ? 0 : (x + y) % 2 ? 90 : 230;
		px.set([v, v, v, 255], i * 4);
	}
	const hole = wordLetters(px, w, h, [{ x: 10, y: 10, w: 4, h: 20 }]);
	expect(hole[20 * w + 12]).toBe(1); // the letter
	expect(hole[20 * w + 8]).toBe(1); // its white outline
	expect(hole[20 * w + 55]).toBe(0); // the art blob
	expect(hole[20 * w + 30]).toBe(0); // the screentone
});

it('with the paper colour given, a gradient caption keeps its background', () => {
	// A caption fading from light to dark blue: its average colour is in the middle, far from both ends, yet the ends are
	// paper, not letters.
	const w = 120, h = 60, px = new Uint8ClampedArray(w * h * 4), area = new Uint8Array(w * h).fill(1);
	for (let i = 0; i < w * h; i++) { const x = i % w; px.set([220 - 1.5 * x, 220 - 1.5 * x, 255, 255], i * 4); }
	const { hole } = letterPixels(px, w, h, area, true, [130, 130, 255]);
	expect(hole.reduce((a, v) => a + v, 0)).toBe(0);
});

it('a word the box edge cuts through is left whole, not half erased', () => {
	// The paper runs off the box's right edge, where a neighbouring line ("ALL RIGHT!") is cut by it: letters 2 px apart,
	// the last touching the edge. Only that letter used to be kept, so "RIG" was erased and "HT!" left.
	const w = 100, h = 40, px = new Uint8ClampedArray(w * h * 4).fill(255), area = new Uint8Array(w * h).fill(1);
	const bar = (x0: number) => { for (let y = 10; y < 22; y++) for (let x = x0; x < x0 + 3; x++) px.set([0, 0, 0, 255], (y * w + x) * 4); };
	for (const x of [20, 25, 30]) bar(x); // the bubble's own word
	for (const x of [77, 82, 87, 92, 97]) bar(x); // the cut word, last letter on the edge
	const { hole, outline } = letterPixels(px, w, h, area, true);
	expect(hole[15 * w + 21]).toBe(1);
	for (const x of [78, 83, 88, 93]) { expect(hole[15 * w + x], `x ${x}`).toBe(0); expect(outline[15 * w + x]).toBe(1); }
});
