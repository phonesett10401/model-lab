import { wrapBurmese } from './fit.ts';

type Line = { text: string; x: number; y: number };

/**
 * Lays Burmese out in a box of any shape. `spans[i]` is the box's inside at row `top + i` as [left, right] (null where
 * the row has none). Each line is as wide as the narrowest span over the rows it covers, so an oval gets short lines at
 * the top and bottom and long ones in the middle. Tries sizes from `maxSize` down to `floor`; `x` is a line's left edge
 * (centred in its span) and `y` its middle. `fits` is 'fit' at or above `minSize`, 'small' below it, and 'too-long' when
 * even `floor` does not fit: then the lines that fit are laid out at `floor` and the rest is cut.
 */
export function fitShaped(
	text: string, spans: ([number, number] | null)[], top: number, measure: (s: string, size: number) => number,
	opts: { maxSize: number; minSize: number; floor: number; lineHeight: number }
): { size: number; lines: Line[]; fits: 'fit' | 'small' | 'too-long' } {
	const rows = spans.flatMap((s, i) => (s ? [i] : []));
	if (!rows.length) return { size: opts.floor, lines: [], fits: 'too-long' };
	const a = rows[0], height = rows[rows.length - 1] + 1 - a;

	/** The text in n lines of `size`, centred in the box; `cut` keeps what fits instead of failing. */
	const lay = (size: number, n: number, cut: boolean): Line[] | null => {
		const lh = size * opts.lineHeight, y0 = a + (height - n * lh) / 2;
		const slots = Array.from({ length: n }, (_, k) => {
			let l = -Infinity, r = Infinity;
			for (let y = Math.floor(y0 + k * lh); y < Math.ceil(y0 + (k + 1) * lh); y++) {
				const s = spans[y];
				if (!s) return null;
				l = Math.max(l, s[0]); r = Math.min(r, s[1] + 1);
			}
			return [l, r] as const;
		});
		const width = (k: number) => (slots[k] ? Math.max(0, slots[k]![1] - slots[k]![0]) : 0);
		const m = (s: string) => measure(s, size);
		const lines = wrapBurmese(text, width, m);
		const ok = (t: string, k: number) => k < n && m(t) <= width(k);
		if (!cut && !(lines.length <= n && lines.every(ok))) return null;
		return lines.flatMap((t, k) => {
			if (!ok(t, k)) return [];
			const s = t.trim();
			return [{ text: s, x: slots[k]![0] + (width(k) - m(s)) / 2, y: top + y0 + (k + 0.5) * lh }];
		});
	};

	for (let size = opts.maxSize; size >= opts.floor; size--)
		for (let n = 1; n * size * opts.lineHeight <= height; n++) {
			const lines = lay(size, n, false);
			if (lines) return { size, lines, fits: size >= opts.minSize ? 'fit' : 'small' };
		}
	const n = Math.floor(height / (opts.floor * opts.lineHeight));
	return { size: opts.floor, lines: n ? lay(opts.floor, n, true)! : [], fits: 'too-long' };
}
