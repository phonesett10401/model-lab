import { describe, expect, it } from 'vitest';
import { assistantAudits } from './audits';
import { validateEntry } from '$lib/validate';
import { allEntries } from '$lib/entries';

describe('assistant audits', () => {
	it('pass the same honesty rules as catalogue audits', () => {
		expect(assistantAudits.flatMap(validateEntry)).toEqual([]);
	});
	it('explain every measured defence: what it changes, what it did and what it can’t fix', () => {
		for (const e of assistantAudits)
			for (const d of e.defences ?? []) expect([d.how, d.result, d.limits].every(Boolean), `${e.slug} ${d.version}`).toBe(true);
	});
	it('stay out of the archive', () => {
		expect(allEntries.some((e) => assistantAudits.some((a) => a.slug === e.slug))).toBe(false);
	});
});
