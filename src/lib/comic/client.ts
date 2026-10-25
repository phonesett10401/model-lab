import type { SentLine, TranslateReply } from './types';

/** Waits before each retry of a passing failure: Gemini's "high demand" spikes last seconds, not milliseconds. */
const RETRY_MS = [3000, 10000];

/** Sends the page's numbered English lines (text only) to our function; a passing failure is tried again twice. */
export async function translatePage(lines: SentLine[], fetchImpl: typeof fetch = fetch, waits = RETRY_MS): Promise<TranslateReply> {
	const once = async (): Promise<TranslateReply> => {
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
	};
	let reply = await once();
	for (const ms of waits) {
		if (reply.ok || reply.error !== 'upstream') break; // quota, busy and bad requests won't pass in seconds
		await new Promise((r) => setTimeout(r, ms));
		reply = await once();
	}
	return reply;
}

export async function serviceInfo(): Promise<{ model: string; fallback?: string; tier: 'free' | 'paid' } | null> {
	try {
		const res = await fetch('/api/translate');
		return res.ok ? await res.json() : null;
	} catch {
		return null;
	}
}
