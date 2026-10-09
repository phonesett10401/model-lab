import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from './chrome';
import { raffelLuo } from '../src/lib/assistant/assistants';
import { CHAT_MODEL, EMBED_MODEL } from '../src/lib/assistant/config';
import { checkCases, parsePlaceholders, summarize, type Case, type NormalQuestion, type Result } from '../src/lib/assistant/score';
import { open, runAll } from './run';

const version = process.env.ASSISTANT_VERSION ?? 'v0';
const read = (path: string) => readFileSync(path, 'utf8');
const git = (args: string) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();

test(`assistant ${version}: normal questions and test cases`, async ({ page }) => {
	const cases: unknown = JSON.parse(read('assistant/raffel-luo/tests/cases.json'));
	const problems = checkCases(cases, raffelLuo.roles.map((r) => r.id));
	if (problems.length) throw new Error(`assistant/tests/cases.json:\n${problems.join('\n')}`);
	const questions: NormalQuestion[] = JSON.parse(read('assistant/raffel-luo/tests/normal.json'));
	const placeholders = parsePlaceholders(read('assistant/raffel-luo/placeholders.txt'));
	const started = new Date().toISOString();

	await open(page, 'raffel-luo', version, 30 * 60_000);
	// Recorded with the results: the spike found the integrated GPU 10–30× slower than the NVIDIA one.
	const gpu = await page.evaluate(async () => {
		const info = (await (navigator as any).gpu?.requestAdapter())?.info;
		return info ? { vendor: info.vendor, architecture: info.architecture, description: info.description } : null;
	});
	if (gpu?.vendor !== 'nvidia')
		console.warn(`\n!!! WARNING: the GPU is "${gpu?.vendor ?? 'none'}", not NVIDIA.\n!!! Timings are not comparable with NVIDIA runs.\n!!! Set Chrome to High performance in Windows Settings > Display > Graphics and run again.\n`);

	const dir = `assistant/results/${version}`;
	mkdirSync(dir, { recursive: true });
	const file = `${dir}/${started.slice(0, 19).replaceAll(':', '-')}.json`;
	const commit = git('rev-parse --short HEAD');
	const dirty = git('status --porcelain') !== '';
	// Rewritten after every result, so a crash or timeout keeps everything recorded so far.
	const save = (results: Result[], complete: boolean) =>
		writeFileSync(file, JSON.stringify({ version, started, commit, dirty, complete, chatModel: CHAT_MODEL, embedModel: EMBED_MODEL, gpu, summary: summarize(results), results }, null, '\t') + '\n');

	const done: Result[] = [];
	const results = await runAll(page, cases as Case[], questions, placeholders, (r) => {
		done.push(r);
		save(done, false);
		console.log(`${r.id.padEnd(8)} ${r.pass === null ? 'manual' : r.pass ? 'pass' : 'FAIL'}${r.error ? ` (${r.error})` : ''}`);
	});
	save(results, true);
	console.log(`${JSON.stringify(summarize(results), null, 2)}\nSaved ${file}`);
});
