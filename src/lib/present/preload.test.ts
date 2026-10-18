import { beforeEach, expect, it } from 'vitest';
import { preloadAll } from './preload';

let made = 0;
beforeEach(() => {
	made = 0;
	URL.createObjectURL = () => `blob:fake/${++made}`;
});

const urls = Array.from({ length: 9 }, (_, i) => `/present/${i}.mp4`);
const ok = (async () => new Response(new Blob(['x']))) as unknown as typeof fetch;

it('fetches every banner into a blob URL and reports progress to 9 / 9', async () => {
	const seen: [number, number][] = [];
	const map = await preloadAll(urls, (d, t) => seen.push([d, t]), ok);
	expect([...map.values()].every((v) => v.startsWith('blob:'))).toBe(true);
	expect(map.size).toBe(9);
	expect(seen).toHaveLength(9);
	expect(seen.at(-1)).toEqual([9, 9]);
});

it('a failed download falls back to the network URL and still counts as done', async () => {
	const flaky = (async (u: string) => {
		if (u === '/present/3.mp4') throw new TypeError('offline');
		if (u === '/present/4.mp4') return new Response('', { status: 404 });
		return new Response(new Blob(['x']));
	}) as unknown as typeof fetch;
	const seen: [number, number][] = [];
	const map = await preloadAll(urls, (d, t) => seen.push([d, t]), flaky);
	expect(map.get('/present/3.mp4')).toBe('/present/3.mp4');
	expect(map.get('/present/4.mp4')).toBe('/present/4.mp4');
	expect(map.get('/present/0.mp4')).toMatch(/^blob:/);
	expect(seen.at(-1)).toEqual([9, 9]);
});
