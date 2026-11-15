import { expect, it } from 'vitest';
import { isSound } from './sfx';

it('knows a found box that only says sound words is a sound effect', () => {
	for (const t of ['SPLASH SPLASH SPLASH', 'GULP', 'GARGLE GARGLE GARGLE', 'AHHHH', 'Zzzz', 'Bam!']) expect(isSound(t), t).toBe(true);
	for (const t of ['OH BOY IS IT THIS MORNING', 'THAT FEELS SO', 'Splash me!', '']) expect(isSound(t), t).toBe(false);
});
