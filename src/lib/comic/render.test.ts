import { expect, it } from 'vitest';
import { boxInside } from './render';

/** A white oval bubble with a 4 px black outline on grey art, three lines of letters inside, the last line's ends within
 * about 8 px of the bottom outline (as on the business comic, where the outline was erased). */
function bubble() {
	const w = 200, h = 120, px = new Uint8ClampedArray(w * h * 4), outline = new Uint8Array(w * h), letter = new Uint8Array(w * h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const d = ((x - 100) / 92) ** 2 + ((y - 60) / 52) ** 2, d2 = ((x - 100) / 88) ** 2 + ((y - 60) / 48) ** 2, i = y * w + x;
			outline[i] = d <= 1 && d2 > 1 ? 1 : 0;
			letter[i] = d2 <= 1 && x > 50 && x < 150 && x % 8 < 3 && ((y >= 35 && y < 47) || (y >= 55 && y < 67) || (y >= 78 && y < 90)) ? 1 : 0;
			const c = outline[i] || letter[i] ? 0 : d2 <= 1 ? 255 : 120;
			px.set([c, c, c, 255], i * 4);
		}
	return { px, w, h, outline, letter };
}

it('erases the letters of a found bubble but never its outline, even with a line close to it', () => {
	const { px, w, h, outline, letter } = bubble();
	const { hole } = boxInside(px, w, h, 'bubble');
	let outlineErased = 0, lettersLeft = 0, letters = 0;
	for (let i = 0; i < w * h; i++) {
		if (outline[i] && hole[i]) outlineErased++;
		if (letter[i]) { letters++; if (!hole[i]) lettersLeft++; }
	}
	expect(outlineErased).toBe(0);
	expect(lettersLeft / letters).toBeLessThan(0.05);
});

it('gives the Burmese only rows inside the outline', () => {
	const { px, w, h } = bubble();
	const { spans } = boxInside(px, w, h, 'bubble');
	const rows = spans.map((s, y) => (s ? y : -1)).filter((y) => y >= 0);
	expect(rows.length).toBeGreaterThan(60);
	expect(Math.min(...rows)).toBeGreaterThan(8);
	expect(Math.max(...rows)).toBeLessThan(h - 8);
});

it('a see-through bubble with word boxes: only those letters erased, the Burmese where they were, with a halo', () => {
	// Screentone art all over (no paper to find), a word of black letters in the middle, a dark art blob in a corner.
	const w = 200, h = 120, px = new Uint8ClampedArray(w * h * 4);
	for (let i = 0; i < w * h; i++) {
		const x = i % w, y = (i / w) | 0;
		const v = x >= 70 && x < 130 && y >= 50 && y < 70 && x % 8 < 3 ? 0 : x < 30 && y < 30 ? 0 : (x + y) % 2 ? 90 : 230;
		px.set([v, v, v, 255], i * 4);
	}
	const { hole, spans, halo } = boxInside(px, w, h, 'bubble', [{ x: 70, y: 50, w: 60, h: 20 }]);
	expect(halo).toBe(true);
	expect(hole[60 * w + 72]).toBe(1);
	expect(hole[10 * w + 10]).toBe(0);
	const rows = spans.map((s, y) => (s ? y : -1)).filter((y) => y >= 0);
	expect(Math.min(...rows)).toBeGreaterThanOrEqual(42);
	expect(Math.max(...rows)).toBeLessThan(78);
	expect(spans[60]![0]).toBeGreaterThanOrEqual(64);
	// without word boxes, the old way: no halo
	expect(boxInside(px, w, h, 'bubble').halo).toBe(false);
});

it('works on a small page\'s boxes enlarged to 1600 px page width, never shrinking', async () => {
	const { zoomFor } = await import('./render');
	expect(zoomFor(900)).toBeCloseTo(1600 / 900); // a 900 px scan: 1–2 px between letters read as rough art
	expect(zoomFor(1600)).toBe(1);
	expect(zoomFor(1500)).toBe(1); // under 10%: not worth it
	expect(zoomFor(3000)).toBe(1);
});

it('maps an enlarged box\'s erase mask and text rows back to page pixels', async () => {
	const { shrink } = await import('./render');
	const w = 10, h = 4, k = 2, W = 20, H = 8, hole = new Uint8Array(W * H);
	hole[3 * W + 7] = 1; // enlarged (7,3) is page (3,1)
	const spans = Array.from({ length: H }, (_, y): [number, number] | null => (y === 5 ? [4, 15] : null));
	const out = shrink({ hole, spans }, w, h, k);
	expect([...out.hole].map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual([1 * w + 3]);
	expect(out.spans[2]).toEqual([2, 7]); // page row 2 takes enlarged row 5
	expect(out.spans[0]).toBeNull();
});
