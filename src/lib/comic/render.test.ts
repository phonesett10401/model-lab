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
