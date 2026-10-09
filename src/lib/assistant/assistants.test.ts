import { describe, expect, it } from 'vitest';
import { assistants, findAssistant, isAssistant, raffelLuo } from './assistants';

describe('assistants', () => {
	it('have unique slugs and numbers, a public role first and a restricted role second', () => {
		expect(new Set(assistants.map((a) => a.slug)).size).toBe(assistants.length);
		expect(new Set(assistants.map((a) => a.no)).size).toBe(assistants.length);
		for (const a of assistants) {
			expect(a.roles).toHaveLength(2);
			expect(a.roles[0].id).not.toBe(a.roles[1].id);
			expect(a.roles.map((r) => r.id)).not.toContain('public');
		}
	});
	it('are found by slug', () => {
		expect(findAssistant('raffel-luo')).toBe(raffelLuo);
		expect(findAssistant('nope')).toBeUndefined();
		expect(findAssistant('toString')).toBeUndefined();
	});
	it('are told apart from catalogue entries', () => {
		expect(isAssistant(raffelLuo)).toBe(true);
		expect(isAssistant({ kind: 'model', slug: 'x' })).toBe(false);
		expect(isAssistant(null)).toBe(false);
	});
});
