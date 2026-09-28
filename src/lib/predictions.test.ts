import { expect, it } from 'vitest';
import { plural, summarize } from './predictions';

it('plurals: -fish words stay the same, others take s', () => {
	expect(plural('fish', 3)).toBe('fish');
	expect(plural('jellyfish', 2)).toBe('jellyfish');
	expect(plural('starfish', 2)).toBe('starfish');
	expect(plural('sea lion', 2)).toBe('sea lions');
	expect(plural('shark', 1)).toBe('shark');
});

it('summarizes detections by count, most first', () => {
	const p = (label: string) => ({ label, score: 0.9 });
	expect(summarize([p('shark'), p('fish'), p('fish'), p('fish')])).toBe('3 fish, 1 shark');
	expect(summarize([p('seal')])).toBe('1 seal');
	expect(summarize([p('seal'), p('seal'), p('crab'), p('crab')])).toBe('2 seals, 2 crabs');
	expect(summarize([])).toBe('');
});
