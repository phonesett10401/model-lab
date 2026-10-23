import { describe, expect, it } from 'vitest';
import { fitText, fontRange, wrapBurmese } from './fit';

const graphemes = (s: string) => [...new Intl.Segmenter('my', { granularity: 'grapheme' }).segment(s)].map((g) => g.segment);
const words = (s: string) => [...new Intl.Segmenter('my', { granularity: 'word' }).segment(s)].map((w) => w.segment);
const m = (s: string) => graphemes(s).length * 10;
const sized = (s: string, size: number) => graphemes(s).length * size;
const COMBINING = /^[ါ-ှ္်]/u;

const text = 'ဘယ်သွားမလဲရှင်';
const G = graphemes(text).length;
const page = { x: 0, y: 0, w: 1000, h: 1000 };

describe('wrapBurmese', () => {
	it('wraps at word breaks', () => {
		const lines = wrapBurmese(text, 30, m);
		expect(lines.length).toBeGreaterThan(1);
		expect(lines.join('')).toBe(text);
		const ws = words(text);
		for (const line of lines) {
			// every line is a run of whole word segments
			let rest = line;
			while (rest) {
				const w = ws.find((x) => rest.startsWith(x));
				expect(w).toBeDefined();
				rest = rest.slice(w!.length);
			}
		}
	});

	it('breaks an overlong word by grapheme', () => {
		// ICU graphemes split Burmese marks off (ာ alone), so an overlong word breaks at syllables.
		const word = 'မင်္ဂလာ';
		expect(words(word)).toEqual([word]);
		const lines = wrapBurmese(word, 10, m);
		expect(lines).toEqual(['မင်္ဂ', 'လာ']);
		for (const line of lines) expect(COMBINING.test(line)).toBe(false);
	});
});

describe('fitText', () => {
	it('shrinks before growing', () => {
		const r = fitText(text, { x: 100, y: 100, w: G * 16, h: 28 }, page, sized);
		expect(r.mode).toBe('fit');
		expect(r.size).toBe(16);
		expect(r.lines).toEqual([text]);
	});

	it('grows inside the page, then covers', () => {
		const box = { x: 100, y: 100, w: (G * 12) / 1.2, h: 21 };
		const grown = fitText(text, box, page, sized);
		expect(grown.mode).toBe('grown');
		expect(grown.box.w).toBeLessThanOrEqual(box.w * 1.3 + 0.001);
		expect(grown.box.x).toBeGreaterThanOrEqual(0);

		const cover = fitText(text.repeat(6), { x: 100, y: 100, w: 10, h: 10 }, page, sized);
		expect(cover.mode).toBe('cover');
		expect(cover.size).toBe(12);
		expect(cover.box.x).toBeGreaterThanOrEqual(page.x);
		expect(cover.box.y).toBeGreaterThanOrEqual(page.y);
		expect(cover.box.x + cover.box.w).toBeLessThanOrEqual(page.x + page.w);
		expect(cover.box.y + cover.box.h).toBeLessThanOrEqual(page.y + page.h);
		expect(cover.lines.join('')).toBe(text.repeat(6));
	});

	it('covers with a box only as big as needed', () => {
		const box = { x: 400, y: 400, w: 60, h: 30 };
		const long = text.repeat(4);
		const cover = fitText(long, box, page, sized);
		expect(cover.mode).toBe('cover');
		// A box smaller by 40% of the original on each axis must not fit at 12, or the cover overshot.
		const smaller = { w: cover.box.w - box.w * 0.4, h: cover.box.h - box.h * 0.4 };
		const lines = wrapBurmese(long, smaller.w, (s) => sized(s, 12));
		const fits = lines.every((l) => sized(l, 12) <= smaller.w) && lines.length * 12 * 1.7 <= smaller.h;
		expect(fits).toBe(false);
	});
});

describe('fontRange', () => {
	it('scales the font sizes with the page width', () => {
		expect(fontRange(600)).toEqual({ minSize: 10, maxSize: 18 });
		expect(fontRange(1600)).toEqual({ minSize: 19, maxSize: 48 });
	});
});
