import { expect, it } from 'vitest';
import { LiveScorer, type LiveView } from './live';

const SR = 32000;
function setup() {
	const calls: { x: Float32Array; resolve: (s: Float32Array) => void }[] = [];
	const views: LiveView[] = [];
	const scorer = new LiveScorer(
		(x) => new Promise((resolve) => calls.push({ x: x.slice(), resolve })),
		['a', 'b'], [0.5, 0.5], (v) => views.push(v)
	);
	return { calls, views, scorer };
}
const tone = (n: number, v: number) => new Float32Array(n).fill(v);
const settle = () => new Promise((r) => setTimeout(r));

it('scores a 1 s slice once a second has arrived, then every half second', async () => {
	const { calls, scorer } = setup();
	scorer.push(tone(SR - 1, 0.1));
	expect(calls).toHaveLength(0);
	scorer.push(tone(1, 0.1));
	expect(calls).toHaveLength(1);
	expect(calls[0].x).toHaveLength(SR);
	calls[0].resolve(new Float32Array([0.9, 0.1]));
	await settle();
	scorer.push(tone(SR / 2, 0.2));
	expect(calls).toHaveLength(2);
	expect(calls[1].x[SR - 1]).toBeCloseTo(0.2); // the newest half second is at the end of the slice
});

it('skips slices while the device is still busy, and counts them', () => {
	const { calls, scorer } = setup();
	scorer.push(tone(SR, 0));
	scorer.push(tone(SR, 0)); // two more slices due while the first is still scoring
	expect(calls).toHaveLength(1);
	expect(scorer.skipped).toBe(2);
});

it('turns scores into events on the stream’s own clock and says what is heard now', async () => {
	const { calls, views, scorer } = setup();
	scorer.push(tone(SR, 0));
	calls[0].resolve(new Float32Array([0.9, 0.1]));
	await settle();
	const v = views.at(-1)!;
	expect(v.now).toEqual(['a']);
	expect(v.predictions.map((p) => p.label)).toEqual(['a']);
	expect(v.from).toBe(0);
});

it('keeps only the last 30 seconds for the result', () => {
	const { scorer } = setup();
	scorer.push(tone(10 * SR, 0.1));
	scorer.push(tone(25 * SR, 0.3));
	const s = scorer.samples();
	expect(s).toHaveLength(30 * SR);
	expect(s[0]).toBeCloseTo(0.1); // 35 s pushed: seconds 5–10 of the first tone remain
	expect(s[s.length - 1]).toBeCloseTo(0.3);
});
