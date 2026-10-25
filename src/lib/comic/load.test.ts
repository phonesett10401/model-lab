import { expect, it } from 'vitest';
import { latestOnly, loadPages } from './load';

it('refuses a PDF over the size cap before reading it', async () => {
	const huge = { name: 'big.pdf', type: 'application/pdf', size: 101 * 1024 * 1024 } as File;
	expect(await loadPages(huge)).toEqual({ ok: false, reason: 'That PDF is too large (over 100 MB). Split it and open one part at a time.' });
});

it('keeps only the latest page and releases the stale one', async () => {
	const closed: string[] = [];
	const bmp = (name: string) => ({ name, close: () => closed.push(name) }) as unknown as ImageBitmap;
	let finish2!: (b: ImageBitmap) => void;
	const latest = latestOnly();
	const second = latest(new Promise<ImageBitmap>((r) => (finish2 = r)));
	const third = latest(Promise.resolve(bmp('p3')));
	expect(await third).toMatchObject({ name: 'p3' });
	finish2(bmp('p2'));
	expect(await second).toBeNull();
	expect(closed).toEqual(['p2']);
});

it('joins several files into one book, in name order', async () => {
	const { joinPages, byName } = await import('./load');
	const bmp = (name: string) => ({ name }) as unknown as ImageBitmap;
	const destroyed: string[] = [];
	const part = (tag: string, count: number) => ({ ok: true as const, count, page: async (i: number) => bmp(`${tag}${i}`), destroy: () => destroyed.push(tag) });
	const book = joinPages([part('a', 1), part('b', 2)]);
	expect(book.count).toBe(3);
	expect(await book.page(0)).toMatchObject({ name: 'a0' });
	expect(await book.page(2)).toMatchObject({ name: 'b1' });
	book.destroy();
	expect(destroyed).toEqual(['a', 'b']);
	const f = (name: string) => ({ name }) as File;
	expect([f('page10.jpg'), f('page2.jpg'), f('Page1.jpg')].sort(byName).map((x) => x.name)).toEqual(['Page1.jpg', 'page2.jpg', 'page10.jpg']);
});
