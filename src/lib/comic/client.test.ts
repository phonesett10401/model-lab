import { expect, it } from 'vitest';
import { translatePage } from './client';

const line = { n: 1, text: 'HELLO', cls: 'bubble' as const, speaker: 'unknown' as const };
const replies = (...bodies: object[]) => {
	let calls = 0;
	const fetchImpl = (async () => new Response(JSON.stringify(bodies[Math.min(calls++, bodies.length - 1)]))) as unknown as typeof fetch;
	return { fetchImpl, calls: () => calls };
};
const ok = { ok: true, lines: [{ n: 1, text: 'မင်္ဂလာပါ' }], model: 'm' };

it('tries again, twice, when Gemini fails in passing', async () => {
	const r = replies({ ok: false, error: 'upstream' }, { ok: false, error: 'upstream' }, ok);
	expect(await translatePage([line], r.fetchImpl, [0, 0])).toEqual(ok);
	expect(r.calls()).toBe(3);
});

it('gives up after the retries, and never retries a used-up quota', async () => {
	const down = replies({ ok: false, error: 'upstream' });
	expect(await translatePage([line], down.fetchImpl, [0, 0])).toEqual({ ok: false, error: 'upstream' });
	expect(down.calls()).toBe(3);
	const quota = replies({ ok: false, error: 'quota' });
	expect(await translatePage([line], quota.fetchImpl, [0, 0])).toEqual({ ok: false, error: 'quota' });
	expect(quota.calls()).toBe(1);
});
