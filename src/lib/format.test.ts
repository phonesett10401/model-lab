import { expect, it } from 'vitest';
import { entryPath, kindLabel, pad, pct } from './format';
import { allEntries } from './entries';

it('formats numbers, kinds and paths', () => {
	expect(pad(3)).toBe('03');
	expect(pad(94)).toBe('94');
	expect(pct(0.936)).toBe(94);
	const model = allEntries.find((e) => e.slug === 'draft-review-mood')!;
	const audit = allEntries.find((e) => e.kind === 'audit')!;
	expect(kindLabel(model)).toBe('TEXT');
	expect(kindLabel(audit)).toBe('AUDIT');
	expect(entryPath(model)).toBe('/models/draft-review-mood');
	expect(entryPath(audit)).toBe(`/audits/${audit.slug}`);
});
