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
		'Translate sound effects (sfx) as Burmese sound words. Keep names as names.',
		'Write Myanmar Unicode only, never Zawgyi.',
		'Reply with JSON only, exactly {"lines":[{"n":<number>,"text":"<Burmese>"}]}, with the same numbers you were given, one entry each.'
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
		return lines.map((l: GotLine) => ({ n: l.n, text: l.text }));
	} catch {
		return null;
	}
}

const reply = (body: TranslateReply | { model: string; tier: string }, status = 200) =>
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

export async function handleTranslate(req: Request, env: ServerEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
	if (req.method === 'GET') return reply({ model: env.model, tier: env.tier });
	if (req.method !== 'POST') return reply({ ok: false, error: 'bad-request' }, 405);
	if (!sameSite(req)) return reply({ ok: false, error: 'forbidden' }, 403);

	const raw = await req.text();
	if (new TextEncoder().encode(raw).length > LIMITS.maxBodyBytes) return reply({ ok: false, error: 'bad-request' }, 400);
	let lines: SentLine[] | null = null;
	try {
		lines = validateLines(JSON.parse(raw));
	} catch { /* bad JSON falls through */ }
	if (!lines) return reply({ ok: false, error: 'bad-request' }, 400);
	if (!env.key) return reply({ ok: false, error: 'upstream' }, 500);

	const { system, user } = buildPrompt(lines);
	let res: Response;
	try {
		res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${env.model}:generateContent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-goog-api-key': env.key },
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: system }] },
				contents: [{ role: 'user', parts: [{ text: user }] }],
				generationConfig: { responseMimeType: 'application/json' }
			})
		});
	} catch {
		return reply({ ok: false, error: 'upstream' }, 502);
	}
	if (res.status === 429) return reply({ ok: false, error: 'quota' }, 429);
	if (!res.ok) return reply({ ok: false, error: 'upstream' }, 502);
	const got = parseGemini(await res.json().catch(() => null));
	if (!got) return reply({ ok: false, error: 'upstream' }, 502);
	return reply({ ok: true, lines: got, model: env.model });
}
