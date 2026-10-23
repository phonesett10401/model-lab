import { describe, expect, it } from 'vitest';
import { buildPrompt, handleTranslate, LIMITS, validateLines } from './translate-server';
import type { ServerEnv, SentLine } from './types';

const env: ServerEnv = { key: 'test-key', model: 'gemini-3.5-flash', tier: 'free' };
const line: SentLine = { n: 1, text: 'HELLO', cls: 'bubble', speaker: 'man' };

function req(body: unknown, origin: string | null = 'https://lab.test', method = 'POST') {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (origin) headers.origin = origin;
	return new Request('https://lab.test/api/translate', {
		method, headers, body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
	});
}

function fakeGemini(status: number, text: string) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetchImpl = (async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status });
	}) as unknown as typeof fetch;
	return { calls, fetchImpl };
}

const burmeseReply = JSON.stringify({ lines: [{ n: 1, text: 'မင်္ဂလာပါ' }] });

describe('validateLines', () => {
	it('accepts numbered text lines', () => {
		expect(validateLines({ lines: [line] })).toEqual([line]);
	});

	it('rejects images and unknown fields', () => {
		expect(validateLines({ lines: [line], image: 'data:image/png;base64,AAAA' })).toBeNull();
		expect(validateLines({ lines: [{ ...line, cls: 'photo' }] })).toBeNull();
		expect(validateLines({ lines: [line, { ...line }] })).toBeNull();
		expect(validateLines({ lines: [{ ...line, text: 'A'.repeat(LIMITS.maxLineChars + 1) }] })).toBeNull();
		expect(validateLines({ lines: Array.from({ length: LIMITS.maxLines + 1 }, (_, i) => ({ ...line, n: i + 1 })) })).toBeNull();
		expect(validateLines({ lines: [{ ...line, extra: 'x' }] })).toBeNull();
	});
});

describe('buildPrompt', () => {
	it('prompt carries speaker and order', () => {
		const p = buildPrompt([{ n: 2, text: 'BOOM', cls: 'sfx', speaker: 'unknown' }, line]);
		expect(p.user.indexOf('1 [man]')).toBeGreaterThanOrEqual(0);
		expect(p.user.indexOf('1 [man]')).toBeLessThan(p.user.indexOf('2 ['));
		expect(p.user).toContain('[sfx]');
		expect(p.system).toContain('ခင်ဗျာ');
		expect(p.system).toContain('ရှင်');
		expect(p.system).toContain('{"lines":[{"n":');
	});
});

describe('handleTranslate', () => {
	it('rejects cross-origin', async () => {
		for (const origin of ['https://evil.test', null]) {
			const g = fakeGemini(200, burmeseReply);
			const res = await handleTranslate(req({ lines: [line] }, origin), env, g.fetchImpl);
			expect(res.status).toBe(403);
			expect(await res.json()).toEqual({ ok: false, error: 'forbidden' });
			expect(g.calls).toHaveLength(0);
		}
	});

	it('rejects oversized body', async () => {
		const g = fakeGemini(200, burmeseReply);
		const res = await handleTranslate(req('x'.repeat(LIMITS.maxBodyBytes + 1)), env, g.fetchImpl);
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ ok: false, error: 'bad-request' });
		expect(g.calls).toHaveLength(0);
	});

	it('sends text only to Gemini', async () => {
		const g = fakeGemini(200, burmeseReply);
		await handleTranslate(req({ lines: [line] }), env, g.fetchImpl);
		expect(g.calls).toHaveLength(1);
		const { url, init } = g.calls[0];
		expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent');
		expect(new Headers(init.headers).get('x-goog-api-key')).toBe('test-key');
		const body = String(init.body);
		expect(JSON.parse(body).generationConfig.responseMimeType).toBe('application/json');
		expect(body).toContain('HELLO');
		expect(body).not.toContain('data:image');
	});

	it('parses fenced JSON', async () => {
		const g = fakeGemini(200, '```json\n' + burmeseReply + '\n```');
		const res = await handleTranslate(req({ lines: [line] }), env, g.fetchImpl);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, lines: [{ n: 1, text: 'မင်္ဂလာပါ' }], model: 'gemini-3.5-flash' });
	});

	it('maps quota', async () => {
		const quota = await handleTranslate(req({ lines: [line] }), env, fakeGemini(429, '').fetchImpl);
		expect(quota.status).toBe(429);
		expect(await quota.json()).toEqual({ ok: false, error: 'quota' });
		for (const [status, text] of [[500, burmeseReply], [200, 'not json at all']] as const) {
			const res = await handleTranslate(req({ lines: [line] }), env, fakeGemini(status, text).fetchImpl);
			expect(res.status).toBe(502);
			expect(await res.json()).toEqual({ ok: false, error: 'upstream' });
		}
	});

	it('GET reports model and tier', async () => {
		const res = await handleTranslate(req(null, 'https://lab.test', 'GET'), env, fakeGemini(200, '').fetchImpl);
		expect(await res.json()).toEqual({ model: 'gemini-3.5-flash', tier: 'free' });
	});

	it('never leaks the key', async () => {
		const cases: Request[] = [
			req({ lines: [line] }), req({ lines: [line] }, 'https://evil.test'), req('{bad'), req(null, 'https://lab.test', 'GET')
		];
		for (const status of [200, 429, 500]) {
			for (const r of cases) {
				const res = await handleTranslate(r.clone(), env, fakeGemini(status, burmeseReply).fetchImpl);
				expect(await res.text()).not.toContain('test-key');
			}
		}
	});
});
