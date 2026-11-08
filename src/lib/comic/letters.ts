/** Side of the cells the local background is measured in; each pixel compares with the 3×3 cells around its own. */
const CELL = 12;
/** Most a channel may differ from the local background for a pixel to count as background, not a letter. */
const INK = 48;
/** The anti-aliased edge around each stroke: letters are grown by this many pixels. */
const EDGE = 2;

/**
 * Which pixels of `area` (1 = look here) are letters: those far in colour from the local background (the commonest
 * colour in the cells around them), grown by EDGE pixels to take the soft edge. Works for dark-on-light and
 * light-on-dark, flat or gradient backgrounds. Never marks a pixel outside `area`.
 */
export function letterPixels(px: Uint8ClampedArray, w: number, h: number, area: Uint8Array): Uint8Array {
	const cw = Math.ceil(w / CELL), ch = Math.ceil(h / CELL);
	// Per cell, counts of quantised colours (4 bits a channel).
	const counts: Map<number, number>[] = Array.from({ length: cw * ch }, () => new Map());
	for (let i = 0; i < w * h; i++) {
		if (!area[i]) continue;
		const key = ((px[i * 4] >> 4) << 8) | ((px[i * 4 + 1] >> 4) << 4) | (px[i * 4 + 2] >> 4);
		const m = counts[((i / w / CELL) | 0) * cw + (((i % w) / CELL) | 0)];
		m.set(key, (m.get(key) ?? 0) + 1);
	}
	// Local background per cell: the commonest colour over it and its neighbours, as the middle of its bucket.
	const bg = new Int16Array(cw * ch * 3).fill(-1);
	for (let cy = 0; cy < ch; cy++)
		for (let cx = 0; cx < cw; cx++) {
			const sum = new Map<number, number>();
			for (let y = Math.max(0, cy - 1); y <= Math.min(ch - 1, cy + 1); y++)
				for (let x = Math.max(0, cx - 1); x <= Math.min(cw - 1, cx + 1); x++)
					for (const [k, v] of counts[y * cw + x]) sum.set(k, (sum.get(k) ?? 0) + v);
			let key = -1, most = 0;
			for (const [k, v] of sum) if (v > most) { most = v; key = k; }
			if (key >= 0) bg.set([((key >> 8) << 4) + 8, (((key >> 4) & 15) << 4) + 8, ((key & 15) << 4) + 8], (cy * cw + cx) * 3);
		}
	const ink = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		if (!area[i]) continue;
		const c = (((i / w / CELL) | 0) * cw + (((i % w) / CELL) | 0)) * 3;
		if (bg[c] < 0) continue;
		// The bucket's middle is up to 8 off the true colour, so the margin is INK + 8.
		for (let k = 0; k < 3; k++) if (Math.abs(px[i * 4 + k] - bg[c + k]) > INK + 8) { ink[i] = 1; break; }
	}
	// Grow over the soft edge, within the area.
	const out = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		if (!ink[i]) continue;
		const x = i % w, y = (i / w) | 0;
		for (let dy = -EDGE; dy <= EDGE; dy++)
			for (let dx = -EDGE; dx <= EDGE; dx++) {
				const xx = x + dx, yy = y + dy, j = yy * w + xx;
				if (xx >= 0 && xx < w && yy >= 0 && yy < h && area[j]) out[j] = 1;
			}
	}
	return out;
}

/**
 * Fills the `hole` pixels in place from the pixels around them, ring by ring from the hole's edge inwards: each pixel
 * takes the average of its already-known neighbours, so flat paper stays flat and a gradient carries on. Pixels outside
 * the hole are never changed.
 */
export function inpaint(px: Uint8ClampedArray, w: number, h: number, hole: Uint8Array): void {
	const known = new Uint8Array(w * h);
	let left = 0;
	for (let i = 0; i < w * h; i++) if (hole[i]) left++; else known[i] = 1;
	while (left) {
		const ring: number[] = [], vals: number[] = [];
		for (let i = 0; i < w * h; i++) {
			if (known[i]) continue;
			const x = i % w, y = (i / w) | 0;
			let r = 0, g = 0, b = 0, k = 0;
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					const xx = x + dx, yy = y + dy, j = yy * w + xx;
					if ((dx || dy) && xx >= 0 && xx < w && yy >= 0 && yy < h && known[j]) { r += px[j * 4]; g += px[j * 4 + 1]; b += px[j * 4 + 2]; k++; }
				}
			if (k) { ring.push(i); vals.push(r / k, g / k, b / k); }
		}
		if (!ring.length) return; // a hole with nothing known around it: left as it is
		ring.forEach((i, n) => { px[i * 4] = vals[n * 3]; px[i * 4 + 1] = vals[n * 3 + 1]; px[i * 4 + 2] = vals[n * 3 + 2]; known[i] = 1; });
		left -= ring.length;
	}
}
