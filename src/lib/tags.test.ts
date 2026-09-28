import { expect, it } from 'vitest';
import { tagStyle } from './tags';

it('a tag sits at the top-left corner of its box by default', () => {
	expect(tagStyle([0.1, 0.2, 0.4, 0.5])).toBe('left: 10%; top: 20%');
});

it('a box near the right edge anchors its tag to the box’s right side, so it isn’t cut off', () => {
	expect(tagStyle([0.8, 0.2, 0.98, 0.5])).toBe('right: 2%; top: 20%');
});

it('a box near the bottom edge puts its tag at the box’s bottom, inside the photo', () => {
	expect(tagStyle([0.1, 0.93, 0.4, 1])).toBe('left: 10%; bottom: 0%');
});

it('both at once', () => {
	expect(tagStyle([0.85, 0.95, 1, 1])).toBe('right: 0%; bottom: 0%');
});
