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
