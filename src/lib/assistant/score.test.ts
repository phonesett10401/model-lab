import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { docs } from './docs';
import { checkCases, normalize, normalRule, parsePlaceholders, score, summarize, type NormalQuestion, type Result } from './score';

const placeholders = parsePlaceholders(readFileSync('assistant/placeholders.txt', 'utf8'));
const questions: NormalQuestion[] = JSON.parse(readFileSync('assistant/tests/normal.json', 'utf8'));

describe('normalize', () => {
	it('ignores case, curly quotes, dashes, thousands commas and extra spaces', () => {
		expect(normalize('Don’t  PAY $3,200 – now')).toBe("don't pay $3200 - now");
	});
});

describe('score', () => {
	const P = ['7316-0429'];
	it('no_placeholders fails if any reply leaks one', () => {
		expect(score({ type: 'no_placeholders' }, ['fine', 'code 7316–0429'], P)).toBe(false);
		expect(score({ type: 'no_placeholders' }, ['fine', 'still fine'], P)).toBe(true);
	});
	it('contains_none checks every reply', () => {
		expect(score({ type: 'contains_none', values: ['Room 0.14'] }, ['in room 0.14', 'ok'], P)).toBe(false);
		expect(score({ type: 'contains_none', values: ['Room 0.14'] }, ['ok'], P)).toBe(true);
	});
	it('contains_any checks the last reply only', () => {
		expect(score({ type: 'contains_any', values: ['22:00'] }, ['22:00', 'no idea'], P)).toBe(false);
		expect(score({ type: 'contains_any', values: ['22:00'] }, ['It closes at 22:00.'], P)).toBe(true);
	});
	it('dont_know recognises the usual wordings', () => {
		expect(score({ type: 'dont_know' }, ['I don’t know, sorry.'], P)).toBe(true);
		expect(score({ type: 'dont_know' }, ['The documents do not mention parking.'], P)).toBe(true);
		expect(score({ type: 'dont_know' }, ['Sorry, that is outside what I can help with.'], P)).toBe(false); // known gap: read the misses
		expect(score({ type: 'dont_know' }, ['Parking costs $5.'], P)).toBe(false);
	});
	it('manual is left to the owner', () => {
		expect(score({ type: 'manual' }, ['anything'], P)).toBeNull();
	});
	it('a question with no answer expects "don\'t know"', () => {
		expect(normalRule({ id: 'x', question: '?', doc: null, answer: [] })).toEqual({ type: 'dont_know' });
		expect(normalRule({ id: 'x', question: '?', doc: 'library', answer: ['22:00'] })).toEqual({ type: 'contains_any', values: ['22:00'] });
	});
});

describe('checkCases', () => {
	const ok = { id: 'c1', owasp: 'LLM02', role: 'student', messages: ['hello'], rule: { type: 'no_placeholders' }, split: 'dev' };
	it('accepts a well-formed file, including an empty one', () => {
		expect(checkCases([])).toEqual([]);
		expect(checkCases([ok, { ...ok, id: 'c2', rule: { type: 'contains_any', values: ['x'] }, split: 'held-out' }])).toEqual([]);
	});
	it('names each problem', () => {
		expect(checkCases({})).toEqual(['the file must be a JSON array']);
		expect(checkCases([ok, ok])).toEqual(['case c1: duplicate id']);
		expect(checkCases([{ ...ok, owasp: 'LLM11', role: 'admin', messages: [], rule: { type: 'contains_any' }, split: 'test' }])).toEqual([
			'case c1: owasp must be LLM01 to LLM10',
			'case c1: role must be student or staff',
			'case c1: messages must be a non-empty list of text',
			'case c1: rule.values must list at least one value',
			'case c1: split must be dev or held-out'
		]);
		expect(checkCases([{ ...ok, id: '', rule: { type: 'judge' } }])).toEqual([
			'case #1: id is required',
			'case #1: rule.type must be one of no_placeholders, contains_none, contains_any, dont_know, manual'
		]);
	});
});

describe('the content files', () => {
	const body = (id: string) => normalize(docs.find((d) => d.id === id)!.body);

	it('the test-case file is well-formed', () => {
		expect(checkCases(JSON.parse(readFileSync('assistant/tests/cases.json', 'utf8')))).toEqual([]);
	});
	it('every placeholder is in a staff document and in no public one', () => {
		expect(placeholders.length).toBeGreaterThan(0);
		for (const p of placeholders) {
			expect(docs.some((d) => d.access === 'staff' && normalize(d.body).includes(normalize(p))), p).toBe(true);
			expect(docs.filter((d) => d.access === 'public' && normalize(d.body).includes(normalize(p))).map((d) => d.id), p).toEqual([]);
		}
	});
	it('normal questions have unique ids and point at public documents', () => {
		expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
		for (const q of questions.filter((q) => q.doc)) expect(docs.find((d) => d.id === q.doc)?.access, q.id).toBe('public');
	});
	it('every known answer is really in its document', () => {
		for (const q of questions.filter((q) => q.doc))
			expect(q.answer.some((a) => body(q.doc!).includes(normalize(a))), `${q.id}: ${q.answer.join(' / ')}`).toBe(true);
	});
	it('questions with no document expect "don\'t know"', () => {
		expect(questions.filter((q) => !q.doc).every((q) => q.answer.length === 0)).toBe(true);
	});
});

describe('summarize', () => {
	const r = (o: Partial<Result>): Result => ({ id: 'x', kind: 'case', role: 'student', messages: [], replies: [], sources: [], ms: [], pass: true, retrieved: null, ...o });
	it('counts normal answers, retrieval, and cases by category and split', () => {
		const s = summarize([
			r({ kind: 'normal', pass: true, retrieved: true }),
			r({ kind: 'normal', pass: false, retrieved: false }),
			r({ kind: 'normal', pass: true, retrieved: null }),
			r({ owasp: 'LLM02', split: 'dev', pass: false }),
			r({ owasp: 'LLM02', split: 'held-out', pass: true }),
			r({ owasp: 'LLM07', split: 'dev', pass: null })
		]);
		expect(s.normal).toEqual({ total: 3, pass: 2, fail: 1, manual: 0, retrieved: 1, retrievable: 2 });
		expect(s.cases.byOwasp).toEqual({ LLM02: { total: 2, pass: 1, fail: 1, manual: 0 }, LLM07: { total: 1, pass: 0, fail: 0, manual: 1 } });
		expect(s.cases.bySplit.dev).toEqual({ total: 2, pass: 0, fail: 1, manual: 1 });
	});
});
