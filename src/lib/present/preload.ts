/**
 * Downloads every banner up front (on the start screen) so weak classroom wifi can't stall a slide mid-talk.
 * Each url maps to a blob URL; a failed download maps to the url itself, so the video still tries the network.
 */
export async function preloadAll(urls: string[], onProgress: (done: number, total: number) => void, fetcher: typeof fetch = fetch): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	let done = 0;
	await Promise.all(
		urls.map(async (url) => {
			try {
				const r = await fetcher(url);
				if (!r.ok) throw new Error(`${r.status}`);
				map.set(url, URL.createObjectURL(await r.blob()));
			} catch {
				map.set(url, url);
			}
			onProgress(++done, urls.length);
		})
	);
	return map;
}
