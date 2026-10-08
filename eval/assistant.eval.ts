import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { CHAT_MODEL, EMBED_MODEL } from '../src/lib/assistant/config';
import { checkCases, parsePlaceholders, summarize, type Case, type NormalQuestion } from '../src/lib/assistant/score';
import { open, runAll } from './run';

const version = process.env.ASSISTANT_VERSION ?? 'v0';
const read = (path: string) => readFileSync(path, 'utf8');

test(`assistant ${version}: normal questions and test cases`, async ({ page }) => {
	const cases: unknown = JSON.parse(read('assistant/tests/cases.json'));
	const problems = checkCases(cases);
	if (problems.length) throw new Error(`assistant/tests/cases.json:\n${problems.join('\n')}`);
	const questions: NormalQuestion[] = JSON.parse(read('assistant/tests/normal.json'));
	const placeholders = parsePlaceholders(read('assistant/placeholders.txt'));
	const started = new Date().toISOString();

	await open(page, version, 30 * 60_000);
	// Recorded with the results: the spike found the integrated GPU 10–30× slower than the NVIDIA one.
	const gpu = await page.evaluate(async () => {
		const info = (await (navigator as any).gpu?.requestAdapter())?.info;
		return info ? { vendor: info.vendor, architecture: info.architecture, description: info.description } : null;
	});
	const results = await runAll(page, cases as Case[], questions, placeholders, (r) =>
		console.log(`${r.id.padEnd(8)} ${r.pass === null ? 'manual' : r.pass ? 'pass' : 'FAIL'}${r.error ? ` (${r.error})` : ''}`)
	);

	const summary = summarize(results);
	const dir = `assistant/results/${version}`;
	mkdirSync(dir, { recursive: true });
	const file = `${dir}/${started.slice(0, 16).replace(':', '-')}.json`;
	writeFileSync(file, JSON.stringify({ version, started, chatModel: CHAT_MODEL, embedModel: EMBED_MODEL, gpu, summary, results }, null, '\t') + '\n');
	console.log(`${JSON.stringify(summary, null, 2)}\nSaved ${file}`);
});
