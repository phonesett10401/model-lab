import type { ModelEntry, ModelInput, Prediction } from '$lib/types';
import type { Runtime } from './index';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Deterministic fake distribution for drafts only. */
export function spread(labels: string[], seed: number): Prediction[] {
	const raw = labels.map((_, i) => ((Math.abs(seed) * (i + 7)) % 97) + 1);
	const sum = raw.reduce((a, b) => a + b, 0);
	return labels.map((label, i) => ({ label, score: raw[i] / sum }));
}

function seedOf(input: ModelInput): number {
	if (input.type === 'text') return [...input.text].reduce((a, c) => a + c.charCodeAt(0), 0);
	if (input.type === 'table') return JSON.stringify(input.values).length * 31;
	return input.blob.size;
}

export function demoRuntime(entry: ModelEntry): Runtime {
	return {
		sizeLabel: 'sample runtime, no download',
		async load(onProgress) {
			for (const p of [0.25, 0.5, 0.75, 1]) {
				onProgress(p);
				await wait(120);
			}
		},
		async classify(input) {
			await wait(typeof window === 'undefined' ? 0 : 1100);
			const sample = entry.samples.find((s) => s.id === input.sampleId);
			return sample ? sample.expected : spread(entry.labels, seedOf(input));
		}
	};
}
