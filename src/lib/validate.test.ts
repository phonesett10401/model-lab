import { describe, expect, it } from 'vitest';
import { validateAll, validateEntry } from './validate';
import { allEntries, visible } from './entries';
import type { AuditEntry, ModelEntry } from './types';

const planned: ModelEntry = {
	kind: 'model', slug: 'x', no: 1, name: 'X', purpose: 'p', status: 'planned',
	input: 'image', labels: [], unsureBelow: 0.6, samples: [],
	report: { data: [], metrics: { title: 'Accuracy per category', rows: [{ label: 'a', value: null }] }, failures: [] }
};

describe('honesty rules', () => {
	it('every real and draft entry passes', () => {
		expect(validateAll(allEntries)).toEqual([]);
	});

	it('a planned model may not show numbers', () => {
		const e = { ...planned, report: { ...planned.report, metrics: { title: 't', rows: [{ label: 'a', value: 0.9 }] } } };
		expect(validateEntry(e)).toContain('x: planned model must not show numbers');
	});

	it('a live model needs measured metrics, a failure and a failing sample', () => {
		const e: ModelEntry = { ...planned, status: 'live', labels: ['a', 'b'] };
		const problems = validateEntry(e);
		expect(problems).toContain('x: live model has unmeasured metrics');
		expect(problems).toContain('x: live model must show at least one failure');
		expect(problems).toContain('x: live model needs a sample it gets wrong');
	});

	it('a published audit needs transcripts or measured metrics', () => {
		const a: AuditEntry = {
			kind: 'audit', slug: 'a', no: 2, name: 'A', purpose: 'p', status: 'published', target: 't', summary: 's',
			transcripts: [], report: { data: [], metrics: { title: 't', rows: [{ label: 'r', value: null }] }, failures: [] }
		};
		expect(validateEntry(a)).toContain('a: published audit has unmeasured metrics');
	});

	it('samples must match the model input type', () => {
		const e: ModelEntry = { ...planned, samples: [{ id: 's', title: 't', input: { type: 'text', text: 'hi' }, expected: [] }] };
		expect(validateEntry(e)).toContain('x: sample s is text, model takes image');
	});

	it('rejects bad slugs and duplicates', () => {
		expect(validateEntry({ ...planned, slug: 'Bad Slug' })).toContain('Bad Slug: slug must be lowercase words joined by hyphens');
		expect(validateAll([planned, { ...planned }])).toContain('duplicate slug: x');
		expect(validateAll([planned, { ...planned, slug: 'y' }])).toContain('duplicate number: 1');
	});

	it('metric values must be fractions', () => {
		const e: ModelEntry = { ...planned, status: 'live', labels: ['a', 'b'], report: { ...planned.report, metrics: { title: 't', rows: [{ label: 'a', value: 94 }] } } };
		expect(validateEntry(e)).toContain('x: metric "a" must be between 0 and 1');
	});
});

describe('drafts', () => {
	it('are hidden when drafts are off', () => {
		expect(visible(allEntries, false).some((e) => e.draft)).toBe(false);
		expect(visible(allEntries, true).length).toBe(allEntries.length);
	});
});
