import type { MetricRow, Prediction } from './types';


export const topN = (p: Prediction[], n = 3) => [...p].sort((a, b) => b.score - a.score).slice(0, n);

export const isUnsure = (p: Prediction[], threshold: number) => {
	const top = topN(p, 1)[0];
	return !top || top.score < threshold;
};

/** "fish" stays "fish" (as do jellyfish, starfish); other creatures take an s. */
export const plural = (label: string, n: number) => (n === 1 || label.endsWith('fish') ? label : `${label}s`);

/** "3 fish, 1 shark": counts per label, most first (ties keep first-seen order). */
export function summarize(p: Prediction[]): string {
	const counts = new Map<string, number>();
	for (const x of p) counts.set(x.label, (counts.get(x.label) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1]).map(([label, n]) => `${n} ${plural(label, n)}`).join(', ');
}

/** Worst first (lowest accuracy, or highest rate when lower is better); unmeasured last. */
export function sortMetrics(rows: MetricRow[], lowerIsBetter = false): MetricRow[] {
	return [...rows].sort((a, b) => {
		if (a.value === null) return b.value === null ? 0 : 1;
		if (b.value === null) return -1;
		return lowerIsBetter ? b.value - a.value : a.value - b.value;
	});
}
