import SOUND_WORDS from './sound-words.json';

/** Sound words (left as drawn on the page), shared with training/comic_autolabel.py. */
const SOUNDS = new Set<string>(SOUND_WORDS);

/** A sound effect: every word of 3+ letters is a sound word (or has a letter drawn out three times, "Ahhh", "Zzzz").
 * Shorter words are left out only beside two or more sound words: there they are the reader's junk around drawn
 * letters ("a » GARGLE GARGLE"); beside one ("OH NO, CRASH!") they are speech, so the bubble is translated. */
export function isSound(text: string): boolean {
	const all = text.toLowerCase().match(/[a-z]+/g) ?? [];
	const long = all.filter((w) => w.length >= 3);
	if (!long.length || (long.length < 2 && long.length < all.length)) return false;
	return long.every((w) => SOUNDS.has(w) || /([a-z])\1\1/.test(w));
}
