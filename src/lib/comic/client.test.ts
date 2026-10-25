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
	const unset = replies({ ok: false, error: 'not-configured' });
	expect(await translatePage([line], unset.fetchImpl, [0, 0])).toEqual({ ok: false, error: 'not-configured' });
	expect(unset.calls()).toBe(1);
	const quota = replies({ ok: false, error: 'quota' });
	expect(await translatePage([line], quota.fetchImpl, [0, 0])).toEqual({ ok: false, error: 'quota' });
	expect(quota.calls()).toBe(1);
});

it('a refused page goes line by line, paced, and keeps every line that came back', async () => {
	const { translateLines } = await import('./client');
	const lines = [1, 2, 3].map((n) => ({ ...line, n, text: `LINE ${n}` }));
	const at: number[] = [];
	const fetchImpl = (async (_: string, init: RequestInit) => {
		at.push(Date.now());
		const sent = JSON.parse(String(init.body)).lines;
		if (sent.length > 1) return new Response(JSON.stringify({ ok: false, error: 'blocked' }));
		if (sent[0].n === 2) return new Response(JSON.stringify({ ok: false, error: 'busy' })); // the per-minute limit
		return new Response(JSON.stringify({ ok: true, model: 'm', lines: [{ n: sent[0].n, text: 'မင်္ဂလာပါ' }] }));
	}) as unknown as typeof fetch;
	const r = await translateLines(lines, fetchImpl, [0, 0], 30);
	expect(r).toMatchObject({ ok: true, lines: [{ n: 1 }, { n: 3 }], blocked: [] });
	for (let i = 2; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(25); // single lines are paced
});
