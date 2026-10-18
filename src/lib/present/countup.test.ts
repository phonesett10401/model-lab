import { expect, it } from 'vitest';
import { countup } from './countup';

it('counts from 0 to the measured value and never past it', () => {
	expect(countup(0.74, 0)).toBe(0);
	expect(countup(0.74, 1)).toBe(0.74);
	expect(countup(0.74, 1.5)).toBe(0.74);
	expect(countup(0.74, -1)).toBe(0);
	let last = 0;
	for (let i = 1; i <= 20; i++) {
		const v = countup(0.74, i / 20);
		expect(v).toBeGreaterThanOrEqual(last);
		expect(v).toBeLessThanOrEqual(0.74);
		last = v;
	}
});
