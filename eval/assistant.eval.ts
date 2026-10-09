import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from './chrome';
import { findAssistant } from '../src/lib/assistant/assistants';
import { CHAT_MODEL, EMBED_MODEL } from '../src/lib/assistant/config';
import { checkCases, knownNumbers, parsePlaceholders, summarize, type Case, type NormalQuestion, type Result } from '../src/lib/assistant/score';
import { open, runAll } from './run';

const slug = process.env.ASSISTANT ?? 'raffel-luo';
const version = process.env.ASSISTANT_VERSION ?? 'v0';
const read = (path: string) => readFileSync(path, 'utf8');
const git = (args: string) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();

test(`assistant ${slug} ${version}: normal questions and test cases`, async ({ page }) => {
	const a = findAssistant(slug);
	if (!a) throw new Error(`no assistant "${slug}" (set ASSISTANT to raffel-luo or pathum-rai)`);
	const base = `assistant/${slug}`;
	const cases: unknown = JSON.parse(read(`${base}/tests/cases.json`));
	const problems = checkCases(cases, a.roles.map((r) => r.id));
	if (problems.length) throw new Error(`${base}/tests/cases.json:\n${problems.join('\n')}`);
	const questions: NormalQuestion[] = JSON.parse(read(`${base}/tests/normal.json`));
	const placeholders = parsePlaceholders(read(`${base}/placeholders.txt`));
	// Numbers anywhere in this assistant's documents; any other number in a reply is reported as unknown.
	const known = readdirSync(`${base}/docs`).flatMap((f) => knownNumbers(read(`${base}/docs/${f}`)));
	const started = new Date().toISOString();

	await open(page, slug, version, 30 * 60_000);
	// Recorded with the results: the spike found the integrated GPU 10–30× slower than the NVIDIA one.
	const gpu = await page.evaluate(async () => {
		const info = (await (navigator as any).gpu?.requestAdapter())?.info;
		return info ? { vendor: info.vendor, architecture: info.architecture, description: info.description } : null;
	});
	if (gpu?.vendor !== 'nvidia')
		console.warn(`\n!!! WARNING: the GPU is "${gpu?.vendor ?? 'none'}", not NVIDIA.\n!!! Timings are not comparable with NVIDIA runs.\n!!! Set Chrome to High performance in Windows Settings > Display > Graphics and run again.\n`);

	const dir = `assistant/results/${slug}/${version}`;
	mkdirSync(dir, { recursive: true });
	const file = `${dir}/${started.slice(0, 19).replaceAll(':', '-')}.json`;
	const commit = git('rev-parse --short HEAD');
	const dirty = git('status --porcelain') !== '';
	// Rewritten after every result, so a crash or timeout keeps everything recorded so far.
	const save = (results: Result[], complete: boolean) =>
		writeFileSync(file, JSON.stringify({ assistant: slug, version, started, commit, dirty, complete, chatModel: CHAT_MODEL, embedModel: EMBED_MODEL, gpu, summary: summarize(results), results }, null, '\t') + '\n');

	const done: Result[] = [];
	const results = await runAll(page, a, cases as Case[], questions, placeholders, known, (r) => {
		done.push(r);
		save(done, false);
		console.log(`${r.id.padEnd(8)} ${r.pass === null ? 'manual' : r.pass ? 'pass' : 'FAIL'}${r.error ? ` (${r.error})` : ''}${r.unknownNumbers.length ? ` (unknown number: ${r.unknownNumbers.join(', ')})` : ''}`);
	});
	save(results, true);
	console.log(`${JSON.stringify(summarize(results), null, 2)}\nSaved ${file}`);
});
