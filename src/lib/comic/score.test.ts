import { expect, it } from 'vitest';
import { wordRecall, words } from './score';

it('splits into lower-case words', () => {
	expect(words("It's TOO hard...")).toEqual(["it's", 'too', 'hard']);
});

it('counts each true word once per occurrence', () => {
	expect(wordRecall(['a b b'], ['b a'])).toEqual({ found: 2, total: 3 });
	expect(wordRecall(['Hello there'], [])).toEqual({ found: 0, total: 2 });
});

it('counts a labelled region as replaced when a translated box covers half of it', async () => {
	const { replacedShare } = await import('./score');
	const labelled = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 300, y: 0, w: 100, h: 100 }];
	expect(replacedShare(labelled, [{ x: 0, y: 0, w: 100, h: 60 }])).toBe(0.5);
	expect(replacedShare(labelled, [{ x: 0, y: 0, w: 100, h: 40 }]), '40% is not replaced').toBe(0);
	expect(replacedShare([], [])).toBeNull();
});

it('fit share counts only boxes that fit without growing or covering', async () => {
	const { fitShare } = await import('./score');
	expect(fitShare(['fit', 'fit', 'cover', 'grown'])).toBe(0.5);
	expect(fitShare([])).toBeNull();
});

it('resume skips done pages', async () => {
	const { doneFiles } = await import('./score');
	expect(doneFiles('{"file":"a.jpg"}\n{"file":"b.jpg"}\n\n')).toEqual(new Set(['a.jpg', 'b.jpg']));
	expect(doneFiles('')).toEqual(new Set());
});
