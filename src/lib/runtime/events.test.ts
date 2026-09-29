import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clock, lanes, summarizeEvents, toEvents } from './events';
import { windowStarts } from './audio';

const cases = JSON.parse(readFileSync('src/lib/runtime/events-cases.json', 'utf8')) as {
	windows: { n: number; starts: number[] }[];
	events: { name: string; labels: string[]; thresholds: number[]; seconds: number; scores: number[][]; expected: unknown[] }[];
};

describe('the same event rule as training (shared cases)', () => {
	for (const w of cases.windows) it(`slices for ${w.n} samples`, () => expect(windowStarts(w.n)).toEqual(w.starts));
	for (const k of cases.events)
		it(k.name, () => {
			const got = toEvents(Float32Array.from(k.scores.flat()), k.scores.length, k.labels, k.thresholds, k.seconds);
			expect(got.map((p) => ({ ...p, score: Math.round(p.score * 1e4) / 1e4 }))).toEqual(k.expected);
		});
});

it('headline counts countable sounds and names steady ones, in order of first appearance', () => {
	const p = (label: string, start: number) => ({ label, start, end: start + 0.5, score: 0.9 });
	expect(summarizeEvents([p('speech', 0.2), p('dog bark', 0.5), p('dog bark', 3), p('knocking', 5)])).toBe('speech, 2 dog barks, 1 knock');
	expect(summarizeEvents([p('rain', 0), p('rain', 4)])).toBe('rain');
});

it('lanes list each sound once, first heard first', () => {
	expect(lanes([{ label: 'b', score: 1, start: 0 }, { label: 'a', score: 1, start: 1 }, { label: 'b', score: 1, start: 2 }])).toEqual(['b', 'a']);
});

it('clock shows minutes, seconds and tenths', () => {
	expect(clock(0.75)).toBe('0:00.8');
	expect(clock(65.25)).toBe('1:05.3');
	expect(clock(59.97)).toBe('1:00.0'); // never "0:60.0"
	expect(clock(119.97)).toBe('2:00.0');
});
