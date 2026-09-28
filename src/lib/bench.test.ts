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

it('sound events keep every event, in time order; none found is the unsure state', () => {
	const ev = [{ label: 'speech', score: 0.9, start: 2, end: 3 }, { label: 'dog bark', score: 0.4, start: 0.5, end: 1 }]; // time order differs from score order
	const r = step({ kind: 'examining', last: null }, { type: 'done', predictions: ev, threshold: 0.5, events: true });
	expect(r).toEqual({ kind: 'result', predictions: [ev[1], ev[0]], unsure: false }); // no threshold filter: the runtime already applied each sound's own
	expect(step({ kind: 'examining', last: null }, { type: 'done', predictions: [], threshold: 0.5, events: true })).toMatchObject({ unsure: true });
});
