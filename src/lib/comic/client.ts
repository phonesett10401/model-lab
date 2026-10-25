import type { GotLine, SentLine, TranslateReply } from './types';

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

/** Gap between single-line requests: the free tier allows about 15 a minute. */
const PACE_MS = 4000;

/**
 * A refused page is sent again line by line, so one refused line doesn't sink the rest; `blocked` names the refused.
 * The single lines are paced, and a line that fails for another reason (busy, down) is left out, so it shows as not
 * translated while every line that came back is kept.
 */
export async function translateLines(lines: SentLine[], fetchImpl: typeof fetch = fetch, waits = RETRY_MS, pace = PACE_MS): Promise<TranslateReply & { blocked?: number[] }> {
	const reply = await translatePage(lines, fetchImpl, waits);
	if (reply.ok || reply.error !== 'blocked' || lines.length < 2) return reply;
	const got: GotLine[] = [], blocked: number[] = [];
	let model = '';
	for (const [i, l] of lines.entries()) {
		if (i) await new Promise((r) => setTimeout(r, pace));
		const one = await translatePage([l], fetchImpl, waits);
		if (one.ok) { got.push(...one.lines); model = one.model; }
		else if (one.error === 'blocked') blocked.push(l.n);
	}
	return { ok: true, lines: got, model, blocked };
}

export async function serviceInfo(): Promise<{ model: string; fallback?: string; tier: 'free' | 'paid' } | null> {
	try {
		const res = await fetch('/api/translate');
		return res.ok ? await res.json() : null;
	} catch {
		return null;
	}
}
