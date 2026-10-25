import type { SentLine, TranslateReply } from './types';

/** Sends the page's numbered English lines (text only) to our function. */
export async function translatePage(lines: SentLine[], fetchImpl: typeof fetch = fetch): Promise<TranslateReply> {
	try {
		const res = await fetchImpl('/api/translate', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ lines })
		});
		return (await res.json()) as TranslateReply;
	} catch {
		return { ok: false, error: 'upstream' };
	}
}

export async function serviceInfo(): Promise<{ model: string; fallback?: string; tier: 'free' | 'paid' } | null> {
	try {
		const res = await fetch('/api/translate');
		return res.ok ? await res.json() : null;
	} catch {
		return null;
	}
}
