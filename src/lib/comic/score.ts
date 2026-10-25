/** Lower-case words: letters, digits and apostrophes; everything else separates. */
export function words(s: string): string[] {
	return s.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

/** How many true words were read, each counted once per occurrence (the order doesn't matter). */
export function wordRecall(truth: string[], got: string[]): { found: number; total: number } {
	const left = new Map<string, number>();
	for (const w of got.flatMap(words)) left.set(w, (left.get(w) ?? 0) + 1);
	let found = 0;
	const all = truth.flatMap(words);
	for (const w of all) {
		const n = left.get(w) ?? 0;
		if (n > 0) {
			found++;
			left.set(w, n - 1);
		}
	}
	return { found, total: all.length };
}

type Rect = { x: number; y: number; w: number; h: number };
const covered = (a: Rect, b: Rect) =>
	(Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))) / (a.w * a.h);

/** Share of labelled text regions with a translated box covering at least half of them (null when there are none). */
export function replacedShare(labelled: Rect[], translated: Rect[]): number | null {
	if (!labelled.length) return null;
	return labelled.filter((l) => translated.some((t) => covered(l, t) >= 0.5)).length / labelled.length;
}

/** Share of lettered boxes whose Burmese fitted without growing the box or covering the art (null when none). */
export function fitShare(modes: ('fit' | 'grown' | 'cover')[]): number | null {
	return modes.length ? modes.filter((m) => m === 'fit').length / modes.length : null;
}

/** Pages already in the evaluation's progress file (one JSON object per line), so a rerun continues. */
export function doneFiles(jsonl: string): Set<string> {
	return new Set(jsonl.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l).file as string));
}
