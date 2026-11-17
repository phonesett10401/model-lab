/** Side of the cells the local background is measured in; each pixel compares with the 3×3 cells around its own. */
const CELL = 12;
/** Most a channel may differ from the local background for a pixel to count as background, not a letter. */
const INK = 48;
/** The anti-aliased edge around each stroke: letters are grown by this many pixels. */
const EDGE = 2;
/** Most space between two letters of one word, in pixels. */
const WORD_GAP = 3;

/**
 * Which pixels of `area` (1 = look here) are letters: those far in colour from the local background (the commonest
 * colour in the cells around them), grown by EDGE pixels to take the soft edge. Works for dark-on-light and
 * light-on-dark, flat or gradient backgrounds. Never marks a pixel outside `area`.
 */
export function letterPixels(px: Uint8ClampedArray, w: number, h: number, area: Uint8Array): Uint8Array;
/** With `enclosed`: only strokes the area encloses are letters (`hole`); strokes reaching the area's edge are its
 * outline or the art past it (`outline`), never erased. Judged on the strokes before growing, so a line of letters near
 * the outline isn't joined to it by the soft edge. `paper`: the box's inside colour; where the commonest colour around is
 * far from it (the middle of a big bold letter), the paper is the background there, so the whole letter is erased. */
export function letterPixels(px: Uint8ClampedArray, w: number, h: number, area: Uint8Array, enclosed: true, paper?: number[]): { hole: Uint8Array; outline: Uint8Array };
export function letterPixels(px: Uint8ClampedArray, w: number, h: number, area: Uint8Array, enclosed = false, paper?: number[]): Uint8Array | { hole: Uint8Array; outline: Uint8Array } {
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
			if (key < 0) continue;
			const c = [((key >> 8) << 4) + 8, (((key >> 4) & 15) << 4) + 8, ((key & 15) << 4) + 8];
			bg.set(paper && c.some((v, k) => Math.abs(v - paper[k]) > INK + 8) ? paper : c, (cy * cw + cx) * 3);
		}
	const ink = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		if (!area[i]) continue;
		const c = (((i / w / CELL) | 0) * cw + (((i % w) / CELL) | 0)) * 3;
		if (bg[c] < 0) continue;
		// The bucket's middle is up to 8 off the true colour, so the margin is INK + 8.
		for (let k = 0; k < 3; k++) if (Math.abs(px[i * 4 + k] - bg[c + k]) > INK + 8) { ink[i] = 1; break; }
	}
	if (!enclosed) return grown(ink, area, w, h);
	const kept = enclosedOnly(ink, area, w, h);
	return { hole: grown(kept, area, w, h), outline: grown(ink.map((v, i) => (v && !kept[i] ? 1 : 0)), area, w, h) };
}

/** The marks grown over their soft edge by EDGE pixels, within the area. */
function grown(ink: Uint8Array, area: Uint8Array, w: number, h: number): Uint8Array {
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

/**
 * Keeps only the marks the area encloses: a connected group of marks that reaches the area's edge is the box's outline
 * or the art past it (on a real page the bubble's bottom outline came out as "letters" and was erased), not lettering.
 * shortcut: a letter drawn touching the outline stays unerased; fine for lettered bubbles.
 */
export function enclosedOnly(marks: Uint8Array, area: Uint8Array, w: number, h: number): Uint8Array {
	const out = new Uint8Array(w * h), seen = new Uint8Array(w * h);
	const group: number[] = [], cut: number[] = [];
	for (let start = 0; start < w * h; start++) {
		if (!marks[start] || seen[start]) continue;
		group.length = 0;
		group.push(start);
		seen[start] = 1;
		let edge = false, offCrop = false;
		for (let k = 0; k < group.length; k++) {
			const i = group[k], x = i % w;
			// The four neighbours; one off the crop or outside the area means the group reaches the edge.
			for (let d = 0; d < 4; d++) {
				const j = d === 0 ? (x > 0 ? i - 1 : -1) : d === 1 ? (x < w - 1 ? i + 1 : -1) : d === 2 ? (i >= w ? i - w : -1) : i < w * (h - 1) ? i + w : -1;
				if (j < 0) offCrop = true;
				if (j < 0 || !area[j]) { edge = true; continue; }
				if (marks[j] && !seen[j]) { seen[j] = 1; group.push(j); }
			}
		}
		if (!edge) for (const i of group) out[i] = 1;
		else if (offCrop) for (const i of group) cut.push(i); // a loop: a big group spread as arguments overflows the stack
	}
	// A word the box's edge cuts through is another line of text running out of the box ("ALL RIGHT!" beside a bubble):
	// its other letters, within WORD_GAP of it along the line, stay too, so it is never left half erased ("RIG" gone, "HT!"
	// kept). Only a row up or down: further, it would jump to the next line, the bubble's own.
	const reached = new Uint8Array(w * h);
	for (const i of cut) reached[i] = 1;
	for (let k = 0; k < cut.length; k++) {
		const x = cut[k] % w, y = (cut[k] / w) | 0;
		for (let dy = -1; dy <= 1; dy++)
			for (let dx = -WORD_GAP; dx <= WORD_GAP; dx++) {
				const xx = x + dx, yy = y + dy, j = yy * w + xx;
				if (xx < 0 || xx >= w || yy < 0 || yy >= h || !marks[j] || reached[j]) continue;
				reached[j] = 1;
				out[j] = 0;
				cut.push(j);
			}
	}
	return out;
}

/**
 * A see-through bubble's letters (RGBA crop, w×h): no paper to measure against, so only pixels inside the reader's word
 * boxes (`words`, crop pixels) count. A letter is what stays dark once screentone dots are blurred to grey (3×3 mean
 * under 119, as CSS blur(1px) contrast(2) under 110); its white outline (light pixels within 4 px) and soft edge (EDGE) go too.
 * Art outside the word boxes is never touched.
 */
export function wordLetters(px: Uint8ClampedArray, w: number, h: number, words: { x: number; y: number; w: number; h: number }[]): Uint8Array {
	const grey = new Float32Array(w * h);
	for (let i = 0; i < w * h; i++) grey[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
	const core = new Uint8Array(w * h), hole = new Uint8Array(w * h);
	for (const q of words)
		for (let y = Math.max(1, Math.floor(q.y - 2)); y < Math.min(h - 1, Math.ceil(q.y + q.h + 2)); y++)
			for (let x = Math.max(1, Math.floor(q.x - 2)); x < Math.min(w - 1, Math.ceil(q.x + q.w + 2)); x++) {
				let s = 0;
				for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += grey[(y + dy) * w + x + dx];
				if (s < 119 * 9) core[y * w + x] = 1;
			}
	for (let i = 0; i < w * h; i++) {
		if (!core[i]) continue;
		const x = i % w, y = (i / w) | 0;
		for (let dy = -4; dy <= 4; dy++)
			for (let dx = -4; dx <= 4; dx++) {
				const lx = x + dx, ly = y + dy;
				if (lx < 0 || ly < 0 || lx >= w || ly >= h) continue;
				const j = ly * w + lx;
				if ((Math.abs(dx) <= EDGE && Math.abs(dy) <= EDGE) || grey[j] > 170) hole[j] = 1;
			}
	}
	return hole;
}
