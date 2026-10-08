import { expect } from '@playwright/test';
import { normalize } from '../src/lib/assistant/score';
import { test } from '../eval/chrome';
import { ask, open } from '../eval/run';

// Real WebLLM on the real GPU (downloads ~1 GB). Opt-in; needs installed Chrome with WebGPU. On the owner's laptop, in PowerShell:
// $env:ASSISTANT_REAL=1; pnpm exec playwright test assistant-real --project chrome --headed
test('the real model answers from the documents, and the chat sends nothing off the device', async ({ page }) => {
	test.skip(!process.env.ASSISTANT_REAL, 'set ASSISTANT_REAL=1 to run the real model');
	test.setTimeout(30 * 60_000);
	await page.goto('/assistant');
	const ok = await page.evaluate(async () => !!(await (navigator as any).gpu?.requestAdapter())?.features.has('shader-f16'));
	test.skip(!ok, 'no WebGPU with 16-bit shaders here');
	await open(page, 'v0', 25 * 60_000);

	const sent: string[] = [];
	page.on('request', (r) => sent.push(`${r.method()} ${r.url()}`));
	const a = await ask(page, 'What time does the library close on weekdays?');
	expect(a.error).toBeUndefined();
	expect(normalize(a.reply)).toMatch(/22:00|10 ?pm|10:00 ?pm/);
	expect(a.sources).toContain('library');
	expect(sent).toEqual([]);
});
