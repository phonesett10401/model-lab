import { expect, it } from 'vitest';
import { bubbleShape } from './bubble';

/** A 100×80 grey box holding a white ellipse with a black outline and a black bar of "text" in the middle. */
function page(cut = false) {
	const w = 100, h = 80, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			// cut: the bubble runs off the right edge of the box, like one cut by the panel border
			const d = ((x - (cut ? 80 : 50)) / 40) ** 2 + ((y - 40) / 30) ** 2;
			const text = x >= (cut ? 65 : 35) && x < (cut ? 90 : 65) && y >= 36 && y < 44;
			const v = d > 1.1 ? 120 : d > 1 ? 0 : text ? 0 : 255;
			px.set([v, v, v, 255], (y * w + x) * 4);
		}
	return { px, w, h };
}

it('keeps the outline and the art, takes the inside and its letters', () => {
	const { px, w, h } = page();
	const s = bubbleShape(px, w, h)!;
	expect(s.color).toBe('rgb(255,255,255)');
	const at = (x: number, y: number) => s.mask[y * w + x];
	expect(at(50, 40)).toBe(1); // a letter in the middle
	expect(at(50, 20)).toBe(1); // white inside
	expect(at(1, 1)).toBe(0); // grey art in the corner
	expect(at(9, 40)).toBe(0); // the outline on the left edge of the ellipse
	// the text area sits inside the ellipse, not over its corners
	expect(s.inner.x).toBeGreaterThan(14);
	expect(s.inner.x + s.inner.w).toBeLessThan(86);
	expect(s.inner.y).toBeGreaterThan(14);
});

it('works on a bubble cut by the edge of the box', () => {
	const { px, w, h } = page(true);
	const s = bubbleShape(px, w, h)!;
	expect(s.mask[40 * w + 75]).toBe(1);
	expect(s.mask[1 * w + 1]).toBe(0);
});

it('gives up on busy art with no bubble', () => {
	const w = 40, h = 40, px = new Uint8ClampedArray(w * h * 4);
	for (let i = 0; i < w * h; i++) px.set([(i * 37) % 256, (i * 91) % 256, (i * 53) % 256, 255], i * 4);
	expect(bubbleShape(px, w, h)).toBeNull();
});
