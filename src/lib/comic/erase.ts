import type { RegionClass } from './types.ts';

/**
 * How to erase the English in a box: fill with the bubble's own colour when one colour clearly dominates,
 * otherwise (busy art, sound effects, text on art) draw a covering box. `pixels` is RGBA for the box only.
 */
export function eraseStyle(pixels: Uint8ClampedArray, cls: RegionClass): { mode: 'fill'; color: string } | { mode: 'cover' } {
	if (cls !== 'bubble' && cls !== 'caption') return { mode: 'cover' };
	const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
	for (let i = 0; i < pixels.length; i += 4) {
		const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
		const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
		const s = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
		s.n++; s.r += r; s.g += g; s.b += b;
		buckets.set(key, s);
	}
	const top = [...buckets.values()].reduce((a, b) => (b.n > a.n ? b : a), { n: 0, r: 0, g: 0, b: 0 });
	if (top.n < (pixels.length / 4) * 0.6) return { mode: 'cover' };
	const avg = (v: number) => Math.round(v / top.n);
	return { mode: 'fill', color: `rgb(${avg(top.r)},${avg(top.g)},${avg(top.b)})` };
}

/** Black text on a light fill, white on a dark one (by the fill's luminance). */
export function inkFor(fill: string): '#000' | '#fff' {
	const [r, g, b] = fill.match(/\d+/g)!.map(Number);
	return 0.299 * r + 0.587 * g + 0.114 * b < 128 ? '#fff' : '#000';
}
