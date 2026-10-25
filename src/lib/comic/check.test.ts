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

	it('flags letters from other scripts mixed into the Burmese, but allows English names', () => {
		const got = (text: string) => checkLines([sent(1, 'GO TO SAITO NOW')], [{ n: 1, text }]).byN.get(1)?.problem;
		expect(got('ဆိုက်တိုဆီ အခုသွားපා')).toBe('not-burmese'); // Sinhala slipped in
		expect(got('ဆိုက်တိုဆီ அခုသွား')).toBe('not-burmese'); // Tamil
		expect(got('Saito ဆီ အခုချက်ချင်းသွား')).toBeNull();
	});

	it('flags an English word left inside the Burmese, but not a name', () => {
		const got = (text: string) => checkLines([sent(1, 'REALITY IS FAR MORE CHAOTIC')], [{ n: 1, text }]).byN.get(1)?.problem;
		expect(got('အဖြစ်မှန်က chaotic ဖြစ်တယ်။')).toBe('not-burmese');
		expect(got('သတ္တိရှိစမ်းပါ Pepper၊ ရဲရဲလုပ်။')).toBeNull();
	});

	it('an empty line on purpose (a sound effect, junk) is left as drawn, not flagged', () => {
		expect(checkLines([sent(1, 'CLAP! CLAP!')], [{ n: 1, text: '' }]).byN.get(1)).toEqual({ text: '', problem: null });
		expect(checkLines([sent(1, 'CLAP!')], [{ n: 1, text: '  ' }]).byN.get(1)).toEqual({ text: '', problem: null });
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

describe('repair never overwrites an edit', () => {
	const base = { id: 1, box: { x: 0, y: 0, w: 10, h: 10 }, cls: 'bubble' as const, speaker: 'unknown' as const, burmese: '', problem: null };
	it('takes the repair only when the visitor has not typed', async () => {
		const { applyRepair } = await import('./check');
		const fresh = applyRepair({ ...base, english: 'HELL0 THERE', ocr: 'HELL0 THERE', edited: false }, { n: 1, text: 'x', english: 'HELLO THERE' });
		expect(fresh).toMatchObject({ english: 'HELLO THERE', ocr: 'HELL0 THERE' });
		const typed = applyRepair({ ...base, english: 'Hi there', ocr: 'HELL0 THERE', edited: true }, { n: 1, text: 'x', english: 'HELLO THERE' });
		expect(typed).toMatchObject({ english: 'Hi there', ocr: 'HELL0 THERE' });
		expect(applyRepair({ ...base, english: 'A', ocr: 'A', edited: false }, { n: 1, text: 'x' }).english).toBe('A');
	});
});
