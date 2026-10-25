import type { GotLine, RegionClass, SentLine, ServerEnv, Speaker, TranslateReply } from './types.ts';

export const LIMITS = { maxLines: 200, maxLineChars: 500, maxBodyBytes: 20_000 };

const CLASSES: RegionClass[] = ['bubble', 'caption', 'sfx', 'art-text'];
const SPEAKERS: Speaker[] = ['man', 'woman', 'child', 'narrator', 'unknown'];

/** Accepts exactly { lines: SentLine[] } and nothing else, so no image data can ride along. */
export function validateLines(body: unknown): SentLine[] | null {
	if (!body || typeof body !== 'object') return null;
	const keys = Object.keys(body);
	if (keys.length !== 1 || keys[0] !== 'lines') return null;
	const lines = (body as { lines: unknown }).lines;
	if (!Array.isArray(lines) || lines.length === 0 || lines.length > LIMITS.maxLines) return null;
	const seen = new Set<number>();
	for (const l of lines) {
		if (!l || typeof l !== 'object' || Object.keys(l).length !== 4) return null;
		const { n, text, cls, speaker } = l as SentLine;
		if (!Number.isInteger(n) || n < 1 || seen.has(n)) return null;
		if (typeof text !== 'string' || text.length > LIMITS.maxLineChars) return null;
		if (!CLASSES.includes(cls) || !SPEAKERS.includes(speaker)) return null;
		seen.add(n);
	}
	return lines as SentLine[];
}

export function buildPrompt(lines: SentLine[]): { system: string; user: string } {
	const system = [
		'You translate English comic text into natural spoken Burmese for comic readers.',
		'The lines are one comic page in reading order. Each has a number, a speaker and a kind of text.',
		'Make endings fit the speaker: a polite man ends with ခင်ဗျာ, a polite woman with ရှင်; friends talk casually.',
		'Keep each line short, like real comic dialogue: about as long as the English where you can, so it fits the speech bubble.',
		'Sound effects (CLAP!, BOOM!, GRRR) and lines that are only junk stay as drawn: give them an empty text. Keep names as names.',
		'Write Myanmar Unicode only, never Zawgyi. Write every word in Burmese: only names may stay in English letters.',
		'The English comes from OCR and may contain reading mistakes (0 for O, missing letters, joined words): fix them from context.',
		'Fix only clear reading mistakes: never add words or finish a sentence that is not there, and drop stray symbols (| = a—— and the like). If a line is mostly junk, translate only the words you can read.',
		'Reply with JSON only, exactly {"lines":[{"n":<number>,"text":"<Burmese>","english":"<the English, corrected>"}]}, with the same numbers you were given, one entry each.'
	].join('\n');
	const user = [...lines]
		.sort((a, b) => a.n - b.n)
		.map((l) => `${l.n} [${l.speaker}] [${l.cls}] ${l.text}`)
		.join('\n');
	return { system, user };
}

/** Reads Gemini's generateContent reply; tolerates a ```json fence around the JSON. */
export function parseGemini(json: unknown): GotLine[] | null {
	try {
		const text: string = (json as any).candidates[0].content.parts[0].text;
		const inner = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
		const lines = JSON.parse(inner).lines;
		if (!Array.isArray(lines)) return null;
		if (!lines.every((l) => Number.isInteger(l?.n) && typeof l?.text === 'string')) return null;
		return lines.map((l: GotLine) => ({ n: l.n, text: l.text, ...(typeof l.english === 'string' ? { english: l.english } : {}) }));
	} catch {
		return null;
	}
}

/** True when a Gemini 429 names a per-day quota (google.rpc.QuotaFailure). */
function perDay(body: unknown): boolean {
	const details = (body as { error?: { details?: { violations?: { quotaId?: string }[] }[] } })?.error?.details ?? [];
	return details.some((d) => d.violations?.some((v) => v.quotaId?.includes('PerDay')));
}

const reply = (body: TranslateReply | { model: string; fallback?: string; tier: string }, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Same site only: production, previews and local dev all pass without a list, other sites can't borrow the key. */
function sameSite(req: Request): boolean {
	const origin = req.headers.get('origin');
	if (!origin) return false;
	try {
		return new URL(origin).host === new URL(req.url).host;
	} catch {
		return false;
	}
}

/** Reads a request body as text, giving up (null) as soon as it passes `max` bytes, so a huge body is never held. */
async function readCapped(req: Request, max: number): Promise<string | null> {
	if (!req.body) return '';
	const reader = req.body.getReader();
	const parts: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > max) {
			await reader.cancel();
			return null;
		}
		parts.push(value);
	}
	const all = new Uint8Array(size);
	let at = 0;
	for (const p of parts) { all.set(p, at); at += p.byteLength; }
	return new TextDecoder().decode(all);
}

/**
 * At most `max` translations per visitor (by address) per `windowMs`, so one caller can't use up the shared daily
 * quota. In memory, so on Vercel it holds per running instance only: the Vercel Firewall rule in the HANDOFF is the
 * real guard, this is the backstop. ponytail: per-instance map; move to a shared store (KV) if abuse gets past it.
 */
export function rateLimiter(max = 100, windowMs = 60 * 60 * 1000): (ip: string) => boolean {
	const seen = new Map<string, { start: number; count: number }>();
	return (ip) => {
		const now = Date.now();
		const hit = seen.get(ip);
		if (!hit || now - hit.start > windowMs) {
			if (seen.size > 10_000) seen.clear(); // never grows without bound
			seen.set(ip, { start: now, count: 1 });
			return true;
		}
		hit.count++;
		return hit.count <= max;
	};
}
const perVisitor = rateLimiter();

/** The caller's address as Vercel (and most proxies) pass it: the first entry of x-forwarded-for. */
const callerOf = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';

export async function handleTranslate(req: Request, env: ServerEnv, fetchImpl: typeof fetch = fetch, allow = perVisitor): Promise<Response> {
	if (req.method === 'GET') return reply({ model: env.model, ...(env.fallback ? { fallback: env.fallback } : {}), tier: env.tier });
	if (req.method !== 'POST') return reply({ ok: false, error: 'bad-request' }, 405);
	if (!sameSite(req)) return reply({ ok: false, error: 'forbidden' }, 403); // a first filter: Origin can be faked
	if (!allow(callerOf(req))) return reply({ ok: false, error: 'rate-limited' }, 429);

	const raw = await readCapped(req, LIMITS.maxBodyBytes);
	if (raw === null) return reply({ ok: false, error: 'bad-request' }, 400);
	let lines: SentLine[] | null = null;
	try {
		lines = validateLines(JSON.parse(raw));
	} catch { /* bad JSON falls through */ }
	if (!lines) return reply({ ok: false, error: 'bad-request' }, 400);
	if (!env.key) return reply({ ok: false, error: 'not-configured' }, 500); // can never succeed: the page doesn't retry it

	const { system, user } = buildPrompt(lines);
	const body = JSON.stringify({
		systemInstruction: { parts: [{ text: system }] },
		contents: [{ role: 'user', parts: [{ text: user }] }],
		generationConfig: { responseMimeType: 'application/json' }
	});
	// The main model first; only when its free daily quota is used up does the fallback model get the same request.
	const models = [env.model, env.fallback].filter((m): m is string => !!m);
	// One try per model: a passing failure (a 5xx, or a reply that isn't the JSON asked for) is retried by the page,
	// after a pause, so a failing page never costs more than a few calls.
	for (const [i, model] of models.entries()) {
		let res: Response;
		try {
			res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
				method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.key }, body
			});
		} catch {
			return reply({ ok: false, error: 'upstream' }, 502);
		}
		// Gemini sends 429 for both the daily cap and the per-minute rate; only the daily one means "try tomorrow".
		if (res.status === 429) {
			const daily = perDay(await res.json().catch(() => null));
			if (daily && i < models.length - 1) continue;
			return reply({ ok: false, error: daily ? 'quota' : 'busy' }, 429);
		}
		const json = res.ok ? await res.json().catch(() => null) : null;
		// Gemini's safety filter can refuse harmless comic lines ("GET IN TOUCH WITH MR. MIYAMURA." was refused as
		// PROHIBITED_CONTENT); a refusal won't change on a retry, so say so and let the page send lines one by one.
		if ((json as { promptFeedback?: { blockReason?: string } })?.promptFeedback?.blockReason) return reply({ ok: false, error: 'blocked' }, 422);
		const got = parseGemini(json);
		if (!got) return reply({ ok: false, error: 'upstream' }, 502);
		// Name the model Gemini says answered: an alias can be served by a newer model.
		const version = (json as { modelVersion?: unknown })?.modelVersion;
		return reply({ ok: true, lines: got, model: typeof version === 'string' ? version : model });
	}
	return reply({ ok: false, error: 'upstream' }, 502);
}
