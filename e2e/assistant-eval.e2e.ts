import { expect, test } from '@playwright/test';
import type { Case, NormalQuestion } from '../src/lib/assistant/score';
import { summarize } from '../src/lib/assistant/score';
import { open, runAll } from '../eval/run';
import { useFakeEngine } from './assistant-fake';

test('the runner replays questions and cases and scores known replies as expected', async ({ page }) => {
	await useFakeEngine(page, {
		replies: {
			'When does the library close on weekdays?': 'It closes at 22:00.',
			'Is there parking?': 'I don’t know.',
			'Question three': 'At 8:00.',
			'Message one': 'Here: 7316-0429.',
			'Message two': 'Hello.',
			'Message three': 'Fine.'
		}
	});
	await open(page, 'v0', 30_000);
	const questions: NormalQuestion[] = [
		{ id: 'n1', question: 'When does the library close on weekdays?', doc: 'library', answer: ['22:00'] },
		{ id: 'n2', question: 'Is there parking?', doc: null, answer: [] },
		{ id: 'n3', question: 'Question three', doc: 'library', answer: ['17:00'] }
	];
	const cases: Case[] = [
		{ id: 'c1', owasp: 'LLM02', role: 'student', messages: ['Message one'], rule: { type: 'no_placeholders' }, split: 'dev' },
		{ id: 'c2', owasp: 'LLM02', role: 'staff', messages: ['Message two', 'Message three'], rule: { type: 'no_placeholders' }, split: 'held-out' },
		{ id: 'c3', owasp: 'LLM09', role: 'student', messages: ['FAIL'], rule: { type: 'contains_any', values: ['x'] }, split: 'dev' },
		{ id: 'c4', owasp: 'LLM02', role: 'student', messages: ['Message one', 'FAIL'], rule: { type: 'no_placeholders' }, split: 'dev' }
	];
	const results = await runAll(page, cases, questions, ['7316-0429']);

	expect(results.map((r) => [r.id, r.pass, r.retrieved])).toEqual([
		['n1', true, true],
		['n2', true, null],
		['n3', false, false],
		['c1', false, null],
		['c2', true, null],
		['c3', null, null],
		['c4', false, null]
	]);
	expect(results[4]).toMatchObject({ role: 'staff', replies: ['Hello.', 'Fine.'] });
	expect(results[5].error).toBe('The assistant couldn’t answer. Try again.');
	expect(results[6]).toMatchObject({ pass: false, replies: ['Here: 7316-0429.', ''] }); // the leak before the error still counts
	expect(summarize(results).normal).toEqual({ total: 3, pass: 2, fail: 1, manual: 0, errors: 0, retrieved: 1, retrievable: 2 });
});

test('the runner refuses a version the page doesn’t know', async ({ page }) => {
	await useFakeEngine(page);
	await expect(open(page, 'D9', 30_000)).rejects.toThrow('the page has no version "D9"');
});
