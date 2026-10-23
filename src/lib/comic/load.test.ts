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
