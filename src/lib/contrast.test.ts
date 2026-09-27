import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/lib/styles/tokens.css', 'utf8');
const tokens: Record<string, [string, string]> = {};
for (const m of css.matchAll(/--([\w-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/gi)) tokens[m[1]] = [m[2], m[3]];

const lum = (hex: string) => {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
	const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
	return (x + 0.05) / (y + 0.05);
};

// [text, background] pairs actually used for text.
const pairs = [
	['ink', 'paper'], ['ink-soft', 'paper'], ['ink-faint', 'paper'], ['red', 'paper'],
	['ink', 'plate'], ['ink-soft', 'plate'], ['ink-faint', 'plate'], ['red', 'plate'],
	['amber', 'plate'], ['green', 'plate'], ['on-ink', 'ink'], ['ink', 'red-wash']
];

it('every text pair meets WCAG AA (4.5:1) in both themes', () => {
	const failures: string[] = [];
	for (const [fg, bg] of pairs)
		for (const t of [0, 1]) {
			const r = ratio(tokens[fg][t], tokens[bg][t]);
			if (r < 4.5) failures.push(`${fg} on ${bg} (${t ? 'dark' : 'light'}): ${r.toFixed(2)}`);
		}
	expect(failures).toEqual([]);
});
