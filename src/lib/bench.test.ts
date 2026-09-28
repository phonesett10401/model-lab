import { describe, expect, it } from 'vitest';
import { initialBench, step } from './bench';

describe('detection results', () => {
	const d = (label: string, score: number) => ({ label, score, box: [0, 0, 1, 1] as [number, number, number, number] });
	it('keeps every detection above the threshold, highest first, not just the top 3', () => {
		const s = step(initialBench, { type: 'done', detect: true, threshold: 0.45, predictions: [d('fish', 0.5), d('shark', 0.9), d('fish', 0.3), d('fish', 0.6), d('crab', 0.7)] });
		expect(s.kind === 'result' && s.predictions.map((p) => p.score)).toEqual([0.9, 0.7, 0.6, 0.5]);
		expect(s.kind === 'result' && s.unsure).toBe(false);
	});
	it('nothing above the threshold is "unsure" (nothing found)', () => {
		const s = step(initialBench, { type: 'done', detect: true, threshold: 0.45, predictions: [d('fish', 0.3)] });
		expect(s.kind === 'result' && s.predictions).toEqual([]);
		expect(s.kind === 'result' && s.unsure).toBe(true);
	});
});
