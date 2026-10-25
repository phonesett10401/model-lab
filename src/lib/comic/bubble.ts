import type { Box } from './types.ts';

/** How far (per colour channel) a pixel may be from the paper colour and still count as paper. */
const NEAR = 40;
/** A rectangle inside an ellipse covers about 71% of each axis, so the text area is pulled in about 15% per side. */
const INSET = 0.15;
/** A second, looser text area, tried before giving up on the oval for a long translation. */
const LOOSE = 0.07;
/** Gaps in an outline up to twice this many pixels wide are closed before the inside is flooded. */
const GAP = 2;

/**
 * Finds the speech bubble in a box (RGBA pixels, w×h): its paper colour, the pixels to paint (the paper inside the
 * outline plus the letters it encloses) and a text area that stays inside the oval. The outline and the art around
 * it are never in the mask. Null when there is no clear bubble, e.g. text drawn on busy art.
 */
export function bubbleShape(px: Uint8ClampedArray, w: number, h: number): { color: string; mask: Uint8Array; inner: Box; loose: Box } | null {
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
	// Outlines have small gaps (the tail, a panel edge); flooding straight through one leaks into a white background
	// and the outline would then be painted over. So flood the paper shrunk by GAP pixels (which closes gaps up to
	// 2×GAP wide), then grow the result back over the paper.
	const paperMap = new Uint8Array(n);
	for (let i = 0; i < n; i++) paperMap[i] = near(i) ? 1 : 0;
	const core = spread(spread(paperMap, w, h, GAP, true), w, h, GAP, true, true);
	const coreInside = flood(middle, (i) => core[i] === 1);
	const grown = spread(spread(coreInside, w, h, GAP, false), w, h, GAP, false, true);
	const inside = new Uint8Array(n);
	for (let i = 0; i < n; i++) inside[i] = grown[i] && paperMap[i] ? 1 : 0;
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
	let enclosed = 0;
	for (let i = 0; i < n; i++) if (!outside[i]) { mask[i] = 1; enclosed++; }

	// Letters that touch the outline or the box edge are reached from outside, so the flood misses them. Bubbles are
	// (nearly) convex: paint everything inside the convex hull of the paper too. The outline lies just outside it.
	// Two joined bubbles make a hull much bigger than the paper, which would paint the art between them: skip it then.
	const hull = hullRows(inside, w, h);
	const hullArea = hull.reduce((a, r) => a + (r ? r[1] - r[0] + 1 : 0), 0);
	if (hullArea <= enclosed * 1.3)
		hull.forEach((r, y) => { if (r) mask.fill(1, y * w + r[0], y * w + r[1] + 1); });

	const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
	const area = (k: number) => ({ x: x0 + bw * k, y: y0 + bh * k, w: bw * (1 - 2 * k), h: bh * (1 - 2 * k) });
	return { color: `rgb(${paper.join(',')})`, mask, inner: area(INSET), loose: area(LOOSE) };
}

/** Shrinks (min) or grows (max) a 0/1 map by r pixels along rows, or along columns when `cols` is set. */
function spread(m: Uint8Array, w: number, h: number, r: number, shrink: boolean, cols = false): Uint8Array {
	const out = new Uint8Array(m.length);
	const [len, lines, step, stride] = cols ? [h, w, w, 1] : [w, h, 1, w];
	for (let l = 0; l < lines; l++) {
		const base = l * stride;
		for (let k = 0; k < len; k++) {
			let v = shrink ? 1 : 0;
			for (let d = -r; d <= r; d++) {
				const j = k + d;
				const got = j < 0 || j >= len ? (shrink ? 1 : 0) : m[base + j * step];
				if (shrink ? !got : got) { v = shrink ? 0 : 1; break; }
			}
			out[base + k * step] = v;
		}
	}
	return out;
}

/** Per row, the [first, last] pixel inside the convex hull of the marked pixels (null where the hull misses the row). */
function hullRows(marked: Uint8Array, w: number, h: number): ([number, number] | null)[] {
	const pts: [number, number][] = [];
	for (let y = 0; y < h; y++) {
		let a = -1, b = -1;
		for (let x = 0; x < w; x++) if (marked[y * w + x]) { if (a < 0) a = x; b = x; }
		if (a >= 0) pts.push([a, y], [b, y]);
	}
	// Monotone chain, points sorted by x then y.
	pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
	const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const half = (list: [number, number][]) => {
		const out: [number, number][] = [];
		for (const p of list) {
			while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
			out.push(p);
		}
		return out.slice(0, -1);
	};
	const poly = pts.length < 3 ? pts : [...half(pts), ...half([...pts].reverse())];
	const rows: ([number, number] | null)[] = Array(h).fill(null);
	for (let y = 0; y < h; y++) {
		let lo = Infinity, hi = -Infinity;
		for (let i = 0; i < poly.length; i++) {
			const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
			if (y < Math.min(ay, by) || y > Math.max(ay, by)) continue;
			const xs = ay === by ? [ax, bx] : [ax + ((y - ay) * (bx - ax)) / (by - ay)];
			for (const x of xs) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
		}
		if (lo <= hi) rows[y] = [Math.max(0, Math.ceil(lo - 1e-9)), Math.min(w - 1, Math.floor(hi + 1e-9))];
	}
	return rows;
}
