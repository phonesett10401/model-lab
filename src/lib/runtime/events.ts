import type { Prediction } from '$lib/types';

export const STEP_S = 0.5;
export const WIN_S = 1;
const PAD_S = (WIN_S - STEP_S) / 2; // a slice's middle part is where its sound most likely is
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Per-slice scores ([count × labels], row-major) → sound events. Same rule as training/sounds_events.py. */
export function toEvents(scores: Float32Array, count: number, labels: string[], thresholds: number[], seconds: number): Prediction[] {
	const out: Prediction[] = [];
	const n = labels.length;
	labels.forEach((label, c) => {
		const raw = (i: number) => scores[i * n + c];
		const hit = (i: number) => raw(i) >= thresholds[c];
		const on = Array.from({ length: count }, (_, i) => hit(i) || (i > 0 && i < count - 1 && hit(i - 1) && hit(i + 1)));
		for (let i = 0; i < count; i++) {
			if (!on[i]) continue;
			let j = i;
			while (j + 1 < count && on[j + 1]) j++;
			let score = 0;
			for (let k = i; k <= j; k++) score = Math.max(score, raw(k));
			const start = i === 0 ? 0 : i * STEP_S + PAD_S;
			const end = j === count - 1 ? seconds : Math.min(seconds, j * STEP_S + WIN_S - PAD_S);
			out.push({ label, start: r2(start), end: r2(end), score });
			i = j;
		}
	});
	return out.sort((a, b) => a.start! - b.start! || labels.indexOf(a.label) - labels.indexOf(b.label));
}

/** Short, separate sounds are counted ("2 dog barks"); steady ones are just named ("rain"). */
const COUNTED: Record<string, [string, string]> = {
	'dog bark': ['dog bark', 'dog barks'], 'cat meow': ['meow', 'meows'], doorbell: ['doorbell ring', 'doorbell rings'],
	knocking: ['knock', 'knocks'], 'glass breaking': ['glass break', 'glass breaks'], 'car horn': ['car horn', 'car horns'],
	thunder: ['thunderclap', 'thunderclaps']
};

export const lanes = (p: Prediction[]) => [...new Set(p.map((x) => x.label))];

export function summarizeEvents(p: Prediction[]): string {
	return lanes(p).map((label) => {
		const n = p.filter((x) => x.label === label).length;
		const noun = COUNTED[label];
		return noun ? `${n} ${noun[n === 1 ? 0 : 1]}` : label;
	}).join(', ');
}

export function clock(s: number): string {
	const tenths = Math.round(s * 10); // round first, so 59.97 s reads 1:00.0, not 0:60.0
	return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
}
