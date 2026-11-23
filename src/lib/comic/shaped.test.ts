import { expect, it } from 'vitest';
import { fitText } from './fit';
import { fitShaped } from './shaped';

/** Row spans of an ellipse centred at (cx, cy) with radii rx, ry, over rows 0..h-1. */
function ellipseSpans(cx: number, cy: number, rx: number, ry: number, h: number) {
	return Array.from({ length: h }, (_, y): [number, number] | null => {
		const t = 1 - ((y - cy) / ry) ** 2;
		if (t <= 0) return null;
		const half = rx * Math.sqrt(t);
		return [Math.ceil(cx - half), Math.floor(cx + half)];
	});
}
const measure = (s: string, size: number) => s.length * size * 0.6;
const opts = { maxSize: 30, minSize: 12, floor: 6, lineHeight: 1.7 };
const text = 'မင်္ဂလာပါ ကျွန်တော်တို့ ဒီနေ့ ဈေးကို သွားကြမယ် ပြီးရင် ထမင်းစားကြမယ်';
const spans = ellipseSpans(200, 100, 180, 90, 200);

/** Every row a line covers must hold the whole line. */
function inside(lines: { text: string; x: number; y: number }[], size: number, sp: ([number, number] | null)[], top: number) {
	for (const l of lines) {
		const half = (size * opts.lineHeight) / 2, wd = measure(l.text, size);
		for (let y = Math.ceil(l.y - half); y < l.y + half; y++) {
			const s = sp[y - top];
			expect(s, `row ${y}`).toBeTruthy();
			expect(l.x, `left at row ${y}`).toBeGreaterThanOrEqual(s![0]);
			expect(l.x + wd, `right at row ${y}`).toBeLessThanOrEqual(s![1] + 1);
		}
	}
}

it('lines follow an ellipse: middle lines longer than the top and bottom ones', () => {
	const r = fitShaped(text, spans, 0, measure, { ...opts, maxSize: 20 });
	expect(r.lines.length).toBeGreaterThanOrEqual(3);
	const wd = (i: number) => measure(r.lines[i].text, r.size);
	const mid = Math.floor(r.lines.length / 2);
	expect(wd(mid)).toBeGreaterThan(wd(0));
	expect(wd(mid)).toBeGreaterThan(wd(r.lines.length - 1));
	expect(r.fits).toBe('fit');
});

it('every line stays inside its row span', () => {
	const top = 50;
	const r = fitShaped(text, spans, top, measure, opts);
	inside(r.lines, r.size, spans, top);
	expect(r.lines.map((l) => l.text).join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
});

it('uses a bigger size than the inscribed rectangle would', () => {
	// The largest rectangle inside the ellipse is about rx·√2 by ry·√2.
	const rect = { x: 200 - 127, y: 100 - 63, w: 254, h: 126 };
	const old = fitText(text, rect, rect, measure, opts);
	const r = fitShaped(text, spans, 0, measure, opts);
	expect(r.size).toBeGreaterThan(old.size);
});

it('too long stays inside at the floor', () => {
	const small = ellipseSpans(40, 20, 35, 18, 40);
	const r = fitShaped(text.repeat(6), small, 0, measure, opts);
	expect(r.fits).toBe('too-long');
	expect(r.size).toBe(opts.floor);
	inside(r.lines, r.size, small, 0);
});

it('a size below the usual minimum is small, not fit', () => {
	const small = ellipseSpans(60, 30, 55, 28, 60);
	const r = fitShaped(text, small, 0, measure, opts);
	expect(r.fits).toBe('small');
	expect(r.size).toBeLessThan(opts.minSize);
	expect(r.size).toBeGreaterThanOrEqual(opts.floor);
});
