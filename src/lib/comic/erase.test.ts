import { expect, it } from 'vitest';
import { eraseStyle } from './erase';

/** RGBA pixels from [count, [r, g, b]] runs. */
function px(...runs: [number, [number, number, number]][]) {
	const out: number[] = [];
	for (const [n, [r, g, b]] of runs) for (let i = 0; i < n; i++) out.push(r, g, b, 255);
	return new Uint8ClampedArray(out);
}

it('fills a plain bubble', () => {
	expect(eraseStyle(px([90, [255, 255, 255]], [10, [0, 0, 0]]), 'bubble')).toEqual({ mode: 'fill', color: 'rgb(255,255,255)' });
});

it('fills a tinted bubble', () => {
	expect(eraseStyle(px([80, [250, 240, 200]], [20, [0, 0, 0]]), 'bubble')).toEqual({ mode: 'fill', color: 'rgb(250,240,200)' });
});

it('covers busy art', () => {
	const busy = px([25, [200, 30, 30]], [25, [30, 200, 30]], [25, [30, 30, 200]], [25, [220, 220, 40]]);
	expect(eraseStyle(busy, 'bubble')).toEqual({ mode: 'cover' });
});

it('covers sfx and art text', () => {
	const white = px([100, [255, 255, 255]]);
	expect(eraseStyle(white, 'sfx')).toEqual({ mode: 'cover' });
	expect(eraseStyle(white, 'art-text')).toEqual({ mode: 'cover' });
});

it('letters white on a dark fill and black on a light one', async () => {
	const { inkFor } = await import('./erase');
	expect(inkFor('rgb(20,20,30)')).toBe('#fff');
	expect(inkFor('rgb(250,240,200)')).toBe('#000');
});
