import { describe, expect, it } from 'vitest';
import { assistantAudits } from './audits';
import { validateEntry } from '$lib/validate';
import { allEntries } from '$lib/entries';

describe('assistant audits', () => {
	it('pass the same honesty rules as catalogue audits', () => {
		expect(assistantAudits.flatMap(validateEntry)).toEqual([]);
	});
	it('stay out of the archive', () => {
		expect(allEntries.some((e) => assistantAudits.some((a) => a.slug === e.slug))).toBe(false);
	});
});
