import { describe, expect, it } from 'vitest';
import { checkLines, isZawgyiLikely } from './check';
import type { SentLine } from './types';

const sent = (n: number, text: string): SentLine => ({ n, text, cls: 'bubble', speaker: 'unknown' });

describe('checkLines', () => {
	it('ok when every line came back in Burmese', () => {
		const r = checkLines([sent(1, 'HELLO THERE')], [{ n: 1, text: 'မင်္ဂလာပါ ခင်ဗျာ' }]);
		expect(r.byN.get(1)).toEqual({ text: 'မင်္ဂလာပါ ခင်ဗျာ', problem: null });
		expect(r.extra).toEqual([]);
	});

	it('flags missing and extra', () => {
		const r = checkLines([sent(1, 'HI'), sent(2, 'YO')], [{ n: 2, text: 'ဟေး' }, { n: 3, text: 'ဟုတ်' }]);
		expect(r.byN.get(1)).toEqual({ text: '', problem: 'missing' });
		expect(r.byN.get(2)?.problem).toBeNull();
		expect(r.extra).toEqual([3]);
	});

	it('flags not Burmese', () => {
		expect(checkLines([sent(1, 'HELLO THERE')], [{ n: 1, text: 'Hello' }]).byN.get(1)?.problem).toBe('not-burmese');
	});

	it('flags Zawgyi', () => {
		expect(isZawgyiLikely('ေမာင္')).toBe(true);
		expect(isZawgyiLikely('မောင်')).toBe(false);
		expect(checkLines([sent(1, 'MAUNG')], [{ n: 1, text: 'ေမာင္' }]).byN.get(1)?.problem).toBe('zawgyi');
	});

	it('flags odd length', () => {
		expect(checkLines([sent(1, 'A'.repeat(40))], [{ n: 1, text: 'ကခဂဃင' }]).byN.get(1)?.problem).toBe('length');
		expect(checkLines([sent(1, 'OK')], [{ n: 1, text: 'ရပြီ' }]).byN.get(1)?.problem).toBeNull();
	});
});
