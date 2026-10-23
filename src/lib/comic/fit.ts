import type { Box } from './types.ts';

const words = new Intl.Segmenter('my', { granularity: 'word' });

// ICU graphemes split Burmese marks off their consonant, so overlong words break at syllables instead:
// before a consonant that isn't stacked under a virama (U+1039) and doesn't carry an asat (U+103A).
const SYLLABLE = /(?<!္)(?=[က-ဪဿ၌-၏](?![်္]))/u;
const syllables = (word: string) => word.split(SYLLABLE).filter(Boolean);

/** Burmese has no spaces between words: break at dictionary word boundaries, or by syllable for a word wider than the line. */
export function wrapBurmese(text: string, maxWidth: number, measure: (s: string) => number): string[] {
	const lines: string[] = [];
	let line = '';
	const place = (piece: string) => {
		if (!line || measure(line + piece) <= maxWidth) line += piece;
		else {
			lines.push(line);
			line = piece;
		}
	};
	for (const { segment } of words.segment(text)) {
		if (measure(segment) <= maxWidth) place(segment);
		else for (const s of syllables(segment)) place(s);
	}
	if (line) lines.push(line);
	return lines;
}

/** Font sizes in page pixels, scaled to the page: a 600 px scan and a 1600 px page should look alike. */
export function fontRange(pageWidth: number): { minSize: number; maxSize: number } {
	const minSize = Math.max(10, Math.round(pageWidth * 0.012));
	return { minSize, maxSize: Math.max(minSize, Math.round(pageWidth * 0.03)) };
}

function grow(box: Box, by: number, page: Box): Box {
	const x = Math.max(page.x, box.x - box.w * by);
	const y = Math.max(page.y, box.y - box.h * by);
	const right = Math.min(page.x + page.w, box.x + box.w * (1 + by));
	const bottom = Math.min(page.y + page.h, box.y + box.h * (1 + by));
	return { x, y, w: right - x, h: bottom - y };
}

/** Fit order: shrink the font, then grow the box a little, and only then cover the art with a bigger box. */
export function fitText(
	text: string, box: Box, page: Box, measure: (s: string, size: number) => number,
	opts: { maxSize?: number; minSize?: number; lineHeight?: number } = {}
): { size: number; lines: string[]; box: Box; mode: 'fit' | 'grown' | 'cover' } {
	const { maxSize = 28, minSize = 12, lineHeight = 1.7 } = opts;
	const lay = (b: Box, size: number) => {
		const lines = wrapBurmese(text, b.w, (s) => measure(s, size));
		const ok = lines.every((l) => measure(l, size) <= b.w) && lines.length * size * lineHeight <= b.h;
		return { lines, ok };
	};
	const best = (b: Box) => {
		for (let size = maxSize; size >= minSize; size--) {
			const r = lay(b, size);
			if (r.ok) return { size, lines: r.lines };
		}
		return null;
	};

	const fit = best(box);
	if (fit) return { ...fit, box, mode: 'fit' };
	for (const by of [0.05, 0.1, 0.15]) {
		const b = grow(box, by, page);
		const r = best(b);
		if (r) return { ...r, box: b, mode: 'grown' };
	}
	let b = box;
	// Small steps, so the covering box is only as big as the text needs and hides as little art as possible.
	for (let by = 0.3; ; by += 0.15) {
		const next = grow(box, by, page);
		const r = lay(next, minSize);
		const stuck = next.w === b.w && next.h === b.h;
		b = next;
		if (r.ok || stuck) return { size: minSize, lines: r.lines, box: b, mode: 'cover' };
	}
}
