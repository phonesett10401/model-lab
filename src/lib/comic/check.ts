import type { GotLine, LineProblem, SentLine } from './types';

/** Burmese length / English length outside this range is flagged (only for English of 10+ chars). */
export const LENGTH_RATIO = { min: 0.3, max: 4 };

const MYANMAR = /[က-႟]/u;
const LETTER = /[\p{L}\p{M}]/u;

// ponytail: heuristic (E-before-consonant, U+1039 as visible killer, U+1060–U+1097 stacked forms); swap for a proper detector if it misfires
export function isZawgyiLikely(s: string): boolean {
	if (/[ၠ-႗]/u.test(s)) return true;
	if (/(^|[^က-႟])ေ[က-အ]/u.test(s)) return true;
	return /္(?![က-အ])/u.test(s);
}

function problemOf(english: string, burmese: string): LineProblem | null {
	const letters = [...burmese].filter((c) => LETTER.test(c));
	if (letters.length === 0 || letters.filter((c) => MYANMAR.test(c)).length < letters.length / 2) return 'not-burmese';
	if (isZawgyiLikely(burmese)) return 'zawgyi';
	if (english.length >= 10) {
		const ratio = burmese.length / english.length;
		if (ratio < LENGTH_RATIO.min || ratio > LENGTH_RATIO.max) return 'length';
	}
	return null;
}

export function checkLines(sent: SentLine[], got: GotLine[]): {
	byN: Map<number, { text: string; problem: LineProblem | null }>; extra: number[];
} {
	const back = new Map(got.map((g) => [g.n, g.text]));
	const byN = new Map<number, { text: string; problem: LineProblem | null }>();
	for (const s of sent) {
		const text = back.get(s.n);
		byN.set(s.n, text === undefined ? { text: '', problem: 'missing' } : { text, problem: problemOf(s.text, text) });
	}
	const asked = new Set(sent.map((s) => s.n));
	return { byN, extra: got.map((g) => g.n).filter((n) => !asked.has(n)) };
}
