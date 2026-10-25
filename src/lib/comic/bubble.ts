import type { Box } from './types.ts';

/** How far (per colour channel) a pixel may be from the paper colour and still count as paper. */
const NEAR = 40;
/** A rectangle inside an ellipse covers about 71% of each axis, so the text area is pulled in about 15% per side. */
const INSET = 0.15;

/**
 * Finds the speech bubble in a box (RGBA pixels, w×h): its paper colour, the pixels to paint (the paper inside the
 * outline plus the letters it encloses) and a text area that stays inside the oval. The outline and the art around
 * it are never in the mask. Null when there is no clear bubble, e.g. text drawn on busy art.
 */
export function bubbleShape(px: Uint8ClampedArray, w: number, h: number): { color: string; mask: Uint8Array; inner: Box } | null {
	const n = w * h;
	const central = (i: number) => {
		const x = i % w, y = (i / w) | 0;
		return x >= w / 4 && x < (w * 3) / 4 && y >= h / 4 && y < (h * 3) / 4;
	};
	// Paper colour: the commonest light colour in the middle half of the box.
	const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
	for (let i = 0; i < n; i++) {
		if (!central(i)) continue;
		const [r, g, b] = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
		if (0.299 * r + 0.587 * g + 0.114 * b < 150) continue;
		const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
		const s = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
		s.n++; s.r += r; s.g += g; s.b += b;
		buckets.set(key, s);
	}
	const top = [...buckets.values()].reduce((a, b) => (b.n > a.n ? b : a), { n: 0, r: 0, g: 0, b: 0 });
	if (!top.n) return null;
	const paper = [top.r / top.n, top.g / top.n, top.b / top.n].map(Math.round);
	const near = (i: number) => Math.abs(px[i * 4] - paper[0]) <= NEAR && Math.abs(px[i * 4 + 1] - paper[1]) <= NEAR && Math.abs(px[i * 4 + 2] - paper[2]) <= NEAR;

	/** 4-connected flood fill from `seeds` through pixels where `pass` holds. */
	const flood = (seeds: number[], pass: (i: number) => boolean) => {
		const seen = new Uint8Array(n);
		const stack = seeds.filter(pass);
		for (const s of stack) seen[s] = 1;
		while (stack.length) {
			const i = stack.pop()!, x = i % w;
			for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
				if (j >= 0 && j < n && !seen[j] && pass(j)) { seen[j] = 1; stack.push(j); }
		}
		return seen;
	};

	// The bubble's inside: paper connected to the paper in the middle of the box.
	const middle: number[] = [];
	for (let i = 0; i < n; i++) if (central(i)) middle.push(i);
	const inside = flood(middle, near);
	let count = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
	for (let i = 0; i < n; i++)
		if (inside[i]) {
			count++;
			const x = i % w, y = (i / w) | 0;
			if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
		}
	if (count < n * 0.15) return null;

	// Everything the box edge reaches without crossing the inside is outline or art; the rest is the bubble and its letters.
	const edge: number[] = [];
	for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
	for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
	const outside = flood(edge, (i) => !inside[i]);
	const mask = new Uint8Array(n);
	for (let i = 0; i < n; i++) mask[i] = outside[i] ? 0 : 1;

	const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
	return {
		color: `rgb(${paper.join(',')})`,
		mask,
		inner: { x: x0 + bw * INSET, y: y0 + bh * INSET, w: bw * (1 - 2 * INSET), h: bh * (1 - 2 * INSET) }
	};
}
