import { expect, it } from 'vitest';
import { wordRecall, words } from './score';

it('splits into lower-case words', () => {
	expect(words("It's TOO hard...")).toEqual(["it's", 'too', 'hard']);
});

it('counts each true word once per occurrence', () => {
	expect(wordRecall(['a b b'], ['b a'])).toEqual({ found: 2, total: 3 });
	expect(wordRecall(['Hello there'], [])).toEqual({ found: 0, total: 2 });
});
