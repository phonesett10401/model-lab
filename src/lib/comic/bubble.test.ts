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

it('paints a letter that touches the outline', () => {
	const w = 100, h = 80, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const d = ((x - 50) / 40) ** 2 + ((y - 40) / 30) ** 2;
			const letter = x >= 9 && x < 30 && y >= 37 && y < 43; // starts on the outline at x=9
			const v = d > 1.1 ? 120 : d > 1 ? 0 : letter ? 0 : 255;
			px.set([v, v, v, 255], (y * w + x) * 4);
		}
	const s = bubbleShape(px, w, h)!;
	expect(s.mask[40 * w + 20]).toBe(1); // the letter's body
	expect(s.mask[10 * w + 1]).toBe(0); // art outside
});

it('paints a letter that touches the edge of a tight box', () => {
	const w = 120, h = 40, px = new Uint8ClampedArray(w * h * 4).fill(255);
	for (let y = 4; y < 36; y++) for (let x = 0; x < 118; x++) if (x % 10 < 3 && (y < 18 || y >= 22)) px.set([0, 0, 0, 255], (y * w + x) * 4);
	const s = bubbleShape(px, w, h)!;
	expect(s.mask[10 * w + 1]).toBe(1); // the first letter, on the left edge
	expect(s.mask[10 * w + 11]).toBe(1);
});

it('does not leak through a small gap in the outline into a white background', () => {
	const w = 100, h = 80, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const d = ((x - 50) / 40) ** 2 + ((y - 40) / 30) ** 2;
			const gap = x > 80 && y >= 39 && y < 42; // 3 px gap in the outline on the right
			const letter = x >= 35 && x < 65 && y >= 36 && y < 44;
			const v = d > 1.1 ? 255 : d > 1 ? (gap ? 255 : 0) : letter ? 0 : 255; // white background outside
			px.set([v, v, v, 255], (y * w + x) * 4);
		}
	const s = bubbleShape(px, w, h)!;
	expect(s.mask[40 * w + 9]).toBe(0); // the outline on the far side stays
	expect(s.mask[15 * w + 74]).toBe(0); // the outline near the top right stays
	expect(s.mask[40 * w + 50]).toBe(1); // the letters go
});

it('puts the text area wholly inside a bubble with a tail', () => {
	const w = 120, h = 100, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const d = ((x - 60) / 40) ** 2 + ((y - 35) / 25) ** 2;
			const tail = y >= 55 && y < 95 && Math.abs(x - (60 + (y - 55) * 0.9)) < (95 - y) / 8; // a long tail down-right
			const v = d <= 1 || tail ? 255 : d <= 1.12 ? 0 : 110;
			px.set([v, v, v, 255], (y * w + x) * 4);
		}
	const s = bubbleShape(px, w, h)!;
	for (const a of [s.inner, s.loose])
		for (const [x, y] of [[a.x, a.y], [a.x + a.w - 1, a.y], [a.x, a.y + a.h - 1], [a.x + a.w - 1, a.y + a.h - 1]])
			expect(((Math.round(x) - 60) / 40) ** 2 + ((Math.round(y) - 35) / 25) ** 2, `corner ${x},${y}`).toBeLessThanOrEqual(1);
	expect(s.loose.w * s.loose.h).toBeGreaterThan(0.4 * Math.PI * 40 * 25); // and still a good share of the oval
});

it('takes white paper, not a coloured light patch, as the bubble', () => {
	const w = 100, h = 100, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const window = y < 60; // a light lilac window filling the top
			const d = ((x - 50) / 35) ** 2 + ((y - 78) / 15) ** 2; // the white bubble at the bottom
			px.set(window ? [200, 180, 240, 255] : d <= 1 ? [255, 255, 255, 255] : d <= 1.15 ? [0, 0, 0, 255] : [60, 40, 30, 255], (y * w + x) * 4);
		}
	const s = bubbleShape(px, w, h)!;
	expect(s.color).toBe('rgb(255,255,255)');
	expect(s.mask[20 * w + 50]).toBe(0); // the window is left alone
});

it('whitens everything outside the bubble for the OCR, keeping the letters', async () => {
	const { whitenOutside } = await import('./bubble');
	const { px, w, h } = page();
	expect(whitenOutside(px, w, h)).toBe(true);
	expect([...px.slice((1 * w + 1) * 4, (1 * w + 1) * 4 + 3)]).toEqual([255, 255, 255]); // art gone
	expect(px[(40 * w + 50) * 4]).toBe(0); // the letter stays
	const busy = new Uint8ClampedArray(40 * 40 * 4).map((_, i) => (i * 37) % 256);
	expect(whitenOutside(busy, 40, 40)).toBe(false); // no bubble: left as it is
});

it('finds the whole bubble around a box that covers only part of it', async () => {
	const { bubbleExtent } = await import('./bubble');
	// A 200×160 crop: the found box is its middle half; the bubble (an ellipse) reaches well beyond that box.
	const w = 200, h = 160, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const d = ((x - 100) / 80) ** 2 + ((y - 80) / 60) ** 2;
			const v = d > 1.1 ? 110 : d > 1 ? 0 : 255;
			px.set([v, v, v, 255], (y * w + x) * 4);
		}
	const e = bubbleExtent(px, w, h)!;
	expect(e.x).toBeLessThan(25);
	expect(e.x + e.w).toBeGreaterThan(175);
	expect(e.y).toBeLessThan(25);
	expect(e.y + e.h).toBeGreaterThan(135);
	// Paper that runs off the crop (no closed bubble around the box): no answer, the box stays as found.
	const open = new Uint8ClampedArray(w * h * 4).fill(255);
	expect(bubbleExtent(open, w, h)).toBeNull();
});

it('grows a small box to a much bigger bubble, looking for paper only inside the box', async () => {
	const { bubbleExtent } = await import('./bubble');
	// "See?" sits at the top of a bubble three times its height; a patch of light art lies near the box but outside the
	// bubble. Only paper connected to the box itself may count.
	const w = 400, h = 320, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const d = ((x - 200) / 120) ** 2 + ((y - 200) / 80) ** 2;
			const patch = x >= 105 && x < 125 && y >= 85 && y < 100;
			const v = patch ? 252 : d > 1.05 ? 110 : d > 1 ? 0 : 255;
			px.set([v, v, v, 255], (y * w + x) * 4);
		}
	const e = bubbleExtent(px, w, h, { x: 170, y: 128, w: 60, h: 36 })!;
	expect(e.y).toBeGreaterThan(110); // the patch above is not part of it
	expect(e.y + e.h).toBeGreaterThan(260); // the bubble's lower part is
});

/** The 100×80 ellipse of `page()`, its paper painted row by row by `paint(y)`, a 30×8 bar of letters in the middle. */
function ellipse(paint: (y: number) => readonly number[], { letters }: { letters: number[] }) {
	const w = 100, h = 80, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const d = ((x - 50) / 40) ** 2 + ((y - 40) / 30) ** 2;
			const text = x >= 35 && x < 65 && y >= 36 && y < 44;
			const c = d > 1.1 ? [110, 110, 110] : d > 1 ? [0, 0, 0] : text ? letters : paint(y);
			px.set([...c, 255], (y * w + x) * 4);
		}
	return { px, w, h };
}

it('finds the inside of a tinted, a gradient and a dark box', () => {
	for (const [name, paint] of [
		['tinted', () => [250, 235, 190]],
		['gradient', (y: number) => [255 - y, 255 - y, 255]], // top white, bottom light blue
		['dark', () => [30, 30, 40]]
	] as const) {
		const { px, w, h } = ellipse(paint, { letters: name === 'dark' ? [240, 240, 240] : [0, 0, 0] });
		const s = bubbleShape(px, w, h)!;
		expect(s, name).not.toBeNull();
		expect(s.mask[40 * w + 50], `${name}: letter`).toBe(1);
		expect(s.inside[40 * w + 50], `${name}: letter is not background`).toBe(0);
		expect(s.inside[20 * w + 50], `${name}: paper is background`).toBe(1);
		expect(s.mask[40 * w + 9], `${name}: outline`).toBe(0);
		expect(s.mask[1 * w + 1], `${name}: art outside`).toBe(0);
	}
});

it('stays fast on a big crop full of round letters (each letter hole is not a bubble)', () => {
	// A 660×270 OCR crop: a white oval packed with "O"s whose holes (10 px) survive the gap closing.
	const w = 660, h = 270, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const d = ((x - 330) / 320) ** 2 + ((y - 135) / 130) ** 2;
			const lx = (x - 90) % 26, ly = (y - 60) % 30, r = Math.hypot(lx - 13, ly - 15);
			const letter = x >= 90 && x < 570 && y >= 60 && y < 210 && r >= 5 && r < 10;
			const v = d > 1.06 ? 110 : d > 1 ? 0 : letter ? 0 : 255;
			px.set([v, v, v, 255], (y * w + x) * 4);
		}
	bubbleShape(px, w, h); // warm up
	const t = performance.now();
	const s = bubbleShape(px, w, h)!;
	expect(performance.now() - t).toBeLessThan(250);
	expect(s.color).toBe('rgb(255,255,255)');
	expect(s.mask[75 * w + 103]).toBe(1); // a letter hole is part of the bubble
});

it('a found box does not grow onto a closed dark blob beside it when its own bubble runs off the crop', async () => {
	const { bubbleExtent } = await import('./bubble');
	// The bubble holding the box runs off the crop's left edge (so the box stays as found); a flat black fill sits
	// beside the box, closed and big enough, but away from the box's middle.
	const w = 200, h = 160, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const d = ((x - 40) / 95) ** 2 + ((y - 80) / 70) ** 2;
			const blob = x >= 146 && x < 195 && y >= 45 && y < 115;
			const v = blob ? 0 : d > 1.08 ? 110 : d > 1 ? 0 : 255;
			px.set([v, v, v, 255], (y * w + x) * 4);
		}
	expect(bubbleExtent(px, w, h, { x: 50, y: 40, w: 100, h: 80 })).toBeNull();
});

it('box growing and the OCR clean-up take only bubble paper, not a smooth painted patch of the art', async () => {
	const { bubbleExtent, whitenOutside } = await import('./bubble');
	// A closed, smoothly painted blue-green patch (like Pepper&Carrot's painted sky) on busy art: lettering may take it as a
	// box's inside, but growing a found box onto it, or whitening around it for the OCR, would lose the text.
	const w = 200, h = 160, px = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const d = ((x - 100) / 80) ** 2 + ((y - 80) / 60) ** 2;
			const c = d > 1.1 ? [(x * 37 + y * 91) % 256, (x * 53) % 256, (y * 71) % 256] : d > 1 ? [0, 0, 0] : [60, 120 + y / 4, 190];
			px.set([...c, 255], (y * w + x) * 4);
		}
	expect(bubbleShape(px, w, h)).not.toBeNull(); // lettering still finds it
	expect(bubbleExtent(px, w, h, { x: 50, y: 40, w: 100, h: 80 })).toBeNull();
	expect(whitenOutside(px.slice(), w, h)).toBe(false);
});

it('gives the extents recorded in bubble-cases.json (the Python port is held to the same cases)', async () => {
	const { bubbleExtent } = await import('./bubble');
	const { inflateSync } = await import('node:zlib');
	const cases = (await import('./bubble-cases.json')).default as { name: string; w: number; h: number; seed: { x: number; y: number; w: number; h: number } | null; rgb: string; extent: number[] | null }[];
	for (const c of cases) {
		const rgb = inflateSync(Buffer.from(c.rgb, 'base64')), px = new Uint8ClampedArray(c.w * c.h * 4);
		for (let i = 0; i < c.w * c.h; i++) px.set([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255], i * 4);
		const e = bubbleExtent(px, c.w, c.h, c.seed ?? undefined);
		expect(e && [e.x, e.y, e.w, e.h], c.name).toEqual(c.extent);
	}
});
