import type { Box } from './types.ts';

/** Most a pixel's channels may differ from each of its neighbours for it to count as smooth background (gradients
 * pass; outlines, letter edges and halftone dots do not). */
const STEP = 20;
/** A small margin inside the largest rectangle that fits in the bubble. */
const INSET = 0.06;
/** A second, looser text area, tried before giving up on the bubble for a long translation. */
const LOOSE = 0;
/** Gaps in an outline up to twice this many pixels wide are closed before the inside is flooded. */
const GAP = 2;
/**
 * Finds the box in a crop (RGBA pixels, w×h): a bubble or narration box of any colour (white, tinted, gradient, dark).
 * `inside` is its background (the smooth region inside the outline, letters left out); `mask` is that plus the letters it
 * encloses (what may be repainted); `color` the background's average colour; `inner`/`loose` a text area that stays
 * inside the oval. The outline and the art around it are never in the mask. Null when there is no clear box, e.g. text
 * drawn on busy art.
 */
export function bubbleShape(px: Uint8ClampedArray, w: number, h: number, seed?: Box): { color: string; mask: Uint8Array; inside: Uint8Array; inner: Box; loose: Box } | null {
	const n = w * h;
	// Where the box's background is looked for: the given area (a found box), else the middle half of the crop.
	const s0 = seed ?? { x: w / 4, y: h / 4, w: w / 2, h: h / 2 };
	const central = (i: number) => {
		const x = i % w, y = (i / w) | 0;
		return x >= s0.x && x < s0.x + s0.w && y >= s0.y && y < s0.y + s0.h;
	};

	// Smooth pixels: close in colour to all four neighbours. A box's background is one connected smooth region.
	const smooth = new Uint8Array(n);
	const close = (i: number, j: number) =>
		Math.abs(px[i * 4] - px[j * 4]) <= STEP && Math.abs(px[i * 4 + 1] - px[j * 4 + 1]) <= STEP && Math.abs(px[i * 4 + 2] - px[j * 4 + 2]) <= STEP;
	for (let i = 0; i < n; i++) {
		const x = i % w;
		smooth[i] = (x === 0 || close(i, i - 1)) && (x === w - 1 || close(i, i + 1)) && (i < w || close(i, i - w)) && (i >= n - w || close(i, i + w)) ? 1 : 0;
	}

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

	// Outlines have small gaps (the tail, a panel edge); flooding straight through one leaks into the background around
	// the bubble and the outline would then be painted over. So flood the smooth map shrunk by GAP pixels (which closes
	// gaps up to 2×GAP wide), then grow each region back over the smooth pixels.
	const core = spread(spread(smooth, w, h, GAP, true), w, h, GAP, true, true);
	const need = seed ? seed.w * seed.h * 0.3 : n * 0.15;
	const cx = s0.x + s0.w / 2, cy = s0.y + s0.h / 2;
	const taken = new Uint8Array(n);
	let inside: Uint8Array | null = null, best = -Infinity;
	for (let i = 0; i < n; i++) {
		if (!central(i) || !core[i] || taken[i]) continue;
		const part = flood([i], (j) => core[j] === 1);
		const grown = spread(spread(part, w, h, GAP, false), w, h, GAP, false, true);
		const region = new Uint8Array(n);
		// Size counts the region with a 1 px rim: the background next to the outline is not smooth but is still the box.
		const rim = spread(spread(grown, w, h, 1, false), w, h, 1, false, true);
		let count = 0, edge = false, near = Infinity;
		for (let j = 0; j < n; j++) {
			if (part[j]) taken[j] = 1;
			if (rim[j]) count++;
			if (!grown[j] || !smooth[j]) continue;
			region[j] = 1;
			const x = j % w, y = (j / w) | 0;
			if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
			if (central(j)) near = Math.min(near, (x - cx) ** 2 + (y - cy) ** 2);
		}
		if (count < need) continue;
		// A closed region (not running off the crop) is the box; otherwise the one nearest the middle of the seed area.
		const score = (edge ? 0 : 1e12) - near;
		if (score > best) { best = score; inside = region; }
	}
	if (!inside) return null;
	let sr = 0, sg = 0, sb = 0;
	let count = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
	for (let i = 0; i < n; i++)
		if (inside[i]) {
			count++; sr += px[i * 4]; sg += px[i * 4 + 1]; sb += px[i * 4 + 2];
			const x = i % w, y = (i / w) | 0;
			if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
		}
	const paper = [sr / count, sg / count, sb / count].map(Math.round);

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

	// The text goes in the largest rectangle that lies wholly inside the bubble: a tail or a cut edge makes the
	// bubble's bounding box much bigger than the oval, and a rectangle cut from that box would stick out of it.
	const room = inscribed(mask, w, h, Math.round((x0 + x1) / 2));
	const shrink = (k: number) => ({ x: room.x + room.w * k, y: room.y + room.h * k, w: room.w * (1 - 2 * k), h: room.h * (1 - 2 * k) });
	return { color: `rgb(${paper.join(',')})`, mask, inside, inner: shrink(INSET), loose: shrink(LOOSE) };
}

/** Largest-area rectangle inside the mask, built from each row's run of mask pixels through column `cx`. */
function inscribed(mask: Uint8Array, w: number, h: number, cx: number): Box {
	const L = new Int32Array(h).fill(-1), R = new Int32Array(h).fill(-2);
	for (let y = 0; y < h; y++) {
		if (!mask[y * w + cx]) continue;
		let a = cx, b = cx;
		while (a > 0 && mask[y * w + a - 1]) a--;
		while (b < w - 1 && mask[y * w + b + 1]) b++;
		L[y] = a; R[y] = b;
	}
	let best: Box = { x: cx, y: 0, w: 1, h: 1 }, bestArea = 0;
	for (let top = 0; top < h; top++) {
		let l = -Infinity, r = Infinity;
		for (let y = top; y < h && L[y] >= 0; y++) {
			l = Math.max(l, L[y]); r = Math.min(r, R[y]);
			const area = (r - l + 1) * (y - top + 1);
			if (area > bestArea) { bestArea = area; best = { x: l, y: top, w: r - l + 1, h: y - top + 1 }; }
		}
	}
	return best;
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

/** For the OCR: paints everything outside the bubble white, so only its letters are read, not the art around them.
 * Returns false (pixels untouched) when the box holds no clear bubble. */
export function whitenOutside(px: Uint8ClampedArray, w: number, h: number): boolean {
	const s = bubbleShape(px, w, h);
	if (!s) return false;
	for (let i = 0; i < s.mask.length; i++) if (!s.mask[i]) px.set([255, 255, 255], i * 4);
	return true;
}

/**
 * The whole bubble around a found box: `px` is a crop centred on the box with room around it (the box is its middle
 * half). Returns the bubble's extent in crop pixels, or null when there is no closed bubble inside the crop (paper
 * that runs off its edge), so the box stays as found.
 */
export function bubbleExtent(px: Uint8ClampedArray, w: number, h: number, seed?: Box): Box | null {
	const s = bubbleShape(px, w, h, seed);
	if (!s) return null;
	let x0 = w, y0 = h, x1 = -1, y1 = -1;
	for (let i = 0; i < s.mask.length; i++)
		if (s.mask[i]) {
			const x = i % w, y = (i / w) | 0;
			if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
		}
	if (x1 < 0 || x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1) return null;
	return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
