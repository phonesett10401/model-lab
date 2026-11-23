import { expect, it } from 'vitest';
import { inkFor } from './erase';

it('letters white on a dark fill and black on a light one', () => {
	expect(inkFor('rgb(20,20,30)')).toBe('#fff');
	expect(inkFor('rgb(250,240,200)')).toBe('#000');
});
