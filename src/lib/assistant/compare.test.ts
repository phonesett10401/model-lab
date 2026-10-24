import { describe, expect, it } from 'vitest';
import { pickComparisons, verdictOf, type CaseResult } from './compare';

const r = (id: string, pass: boolean | null, extra: Partial<CaseResult> = {}): CaseResult => ({ id, messages: ['q'], replies: ['a'], pass, ...extra });

describe('verdictOf', () => {
	it('tells a leak, a partial leak, a stop by a defence, a safe reply and an unjudged one apart', () => {
		expect(verdictOf(r('x', false))).toBe('leaked');
		expect(verdictOf(r('x', false, { hand: 'partly-leaked' }))).toBe('partly-leaked');
		expect(verdictOf(r('x', true, { blockedBy: ['D3'] }))).toBe('stopped');
		expect(verdictOf(r('x', true, { blockedBy: [''] }))).toBe('safe');
		expect(verdictOf(r('x', null))).toBe('unsure');
	});
});

describe('pickComparisons', () => {
	const v0 = [r('bipia-2', false), r('bipia-1', false), r('deepset-1', false), r('plain-1', false), r('deepset-2', true)];
	const D3 = [r('bipia-2', true, { blockedBy: ['D3'] }), r('bipia-1', true, { blockedBy: ['D3'] }), r('deepset-1', false, { hand: 'leaked' }), r('plain-1', true, { blockedBy: ['D3'] }), r('deepset-2', false, { hand: 'leaked' })];
	const v1 = [...v0.map((x) => r(x.id, true))];

	it('takes the first attack by id that leaked on v0 and D3 stopped, then the first D3 let through by hand judgement', () => {
		expect(pickComparisons({ v0, D3, v1 }).map((c) => c.id)).toEqual(['bipia-1', 'deepset-1']);
	});
	it('prefers a D3 hand leak that also leaked on v0, and never picks a plain question', () => {
		expect(pickComparisons({ v0, D3, v1 })[1].id).toBe('deepset-1');
		expect(pickComparisons({ v0, D3, v1 }).some((c) => c.id.startsWith('plain'))).toBe(false);
	});
	it('skips a comparison it can’t find, and needs all three runs', () => {
		const noHand = D3.map((x) => (x.pass === false ? { ...x, hand: undefined } : x));
		expect(pickComparisons({ v0, D3: noHand, v1 }).map((c) => c.id)).toEqual(['bipia-1']);
		expect(pickComparisons({ v0, D3 })).toEqual([]);
	});
	it('only compares attacks every version ran', () => {
		expect(pickComparisons({ v0, D3, v1: v1.filter((x) => x.id !== 'bipia-1') })[0].id).toBe('bipia-2');
	});
});
