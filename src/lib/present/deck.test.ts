import { expect, it } from 'vitest';
import { hashFor, indexFromHash, keyAction, step, swipeAction } from './deck';

it('keys map like PowerPoint and clickers', () => {
	for (const k of [' ', 'ArrowDown', 'ArrowRight', 'PageDown']) expect(keyAction(k)).toBe('next');
	for (const k of ['ArrowUp', 'ArrowLeft', 'PageUp']) expect(keyAction(k)).toBe('prev');
	expect(keyAction('Home')).toBe('first');
	expect(keyAction('End')).toBe('last');
	expect(keyAction('f')).toBe('fullscreen');
	expect(keyAction('F')).toBe('fullscreen');
	expect(keyAction('a')).toBeNull();
});

it('clamps and ignores repeats', () => {
	expect(step(9, 'next', 9)).toBe(9);
	expect(step(0, 'prev', 9)).toBe(0);
	expect(step(0, 'next', 9)).toBe(1);
	expect(step(4, 'first', 9)).toBe(1);
	expect(step(4, 'last', 9)).toBe(9);
	expect(step(4, null, 9)).toBe(4);
	expect(step(4, 'fullscreen', 9)).toBe(4);
});

it('hash round-trips and rejects junk', () => {
	expect(hashFor(4)).toBe('#4');
	expect(indexFromHash('#4', 9)).toBe(4);
	for (const h of ['', '#', '#0', '#10', '#x', '#-1']) expect(indexFromHash(h, 9)).toBeNull();
});

it('swipes work like a phone feed: finger up = next, finger down = back', () => {
	expect(swipeAction(0, -120)).toBe('next'); // finger moved up the screen
	expect(swipeAction(0, 120)).toBe('prev');
	expect(swipeAction(10, -30)).toBeNull(); // too short: a tap or a wobble
	expect(swipeAction(150, -60)).toBeNull(); // mostly sideways
});
