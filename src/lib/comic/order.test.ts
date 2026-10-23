import { expect, it } from 'vitest';
import { readingOrder } from './order';

const at = (x: number, y: number) => ({ box: { x, y, w: 50, h: 40 } });

it('rows then left to right', () => {
	const items = [at(10, 200), at(300, 10), at(10, 20)];
	expect(readingOrder(items).map((i) => [i.box.x, i.box.y])).toEqual([[10, 20], [300, 10], [10, 200]]);
	expect(readingOrder(items, true).map((i) => [i.box.x, i.box.y])).toEqual([[300, 10], [10, 20], [10, 200]]);
});
