import { expect, it } from 'vitest';
import { enter, filled } from './intro-story';

it('the spine fills with the share of the steps above the middle of the screen', () => {
	// steps 2000px tall, viewport 800px: middle at 400
	expect(filled(900, 2000, 800)).toBe(0); // not reached yet
	expect(filled(400, 2000, 800)).toBe(0);
	expect(filled(-600, 2000, 800)).toBe(0.5);
	expect(filled(-1600, 2000, 800)).toBe(1);
	expect(filled(-5000, 2000, 800)).toBe(1);
});

it('a step builds from 0 as its top passes 80% down the screen to 1 once it is centred', () => {
	// viewport 800, step 600 tall: starts at top = 640, centred at top = 400 - 300 = 100
	expect(enter(800, 600, 800)).toBe(0); // entering, still below the start line
	expect(enter(640, 600, 800)).toBe(0);
	expect(enter(370, 600, 800)).toBe(0.5);
	expect(enter(100, 600, 800)).toBe(1); // centred
	expect(enter(-2000, 600, 800)).toBe(1); // scrolled past: stays finished
});
