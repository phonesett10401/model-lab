import { expect, it } from 'vitest';
import { isSound } from './sfx';

// The reader adds 1–2 letter junk around drawn letters ("a » GARGLE…", read on a Garfield strip): those don't count.
it('knows a found box that only says sound words is a sound effect', () => {
	for (const t of ['SPLASH SPLASH SPLASH', 'GULP', 'GARGLE GARGLE GARGLE', 'AHHHH', 'Zzzz', 'Bam!', 'a » GARGLE GARGLE GARGLE', 'VE GARGLE GARGLE']) expect(isSound(t), t).toBe(true);
	for (const t of ['OH BOY IS IT THIS MORNING', 'THAT FEELS SO', 'Splash him!', '', 'HA HA', 'OH']) expect(isSound(t), t).toBe(false);
});
