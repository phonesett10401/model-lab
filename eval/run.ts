import type { Page } from '@playwright/test';
import type { Role } from '../src/lib/assistant/config';
import { normalRule, score, type Case, type NormalQuestion, type Result } from '../src/lib/assistant/score';

const ANSWER_TIMEOUT = 5 * 60_000; // a slow (integrated) GPU can take minutes per answer

/** Opens /assistant at a version, starts it, and waits until it's ready (the first time includes the download). */
export async function open(page: Page, version: string, loadTimeout: number) {
	await page.goto(`/assistant?version=${encodeURIComponent(version)}`);
	const shown = await page.locator('.assistant[data-version]').getAttribute('data-version');
	if (shown !== version) throw new Error(`the page has no version "${version}" (add it to VERSIONS in src/lib/assistant/config.ts)`);
	await page.getByRole('button', { name: 'Start the assistant' }).click();
	const done = page.locator('.assistant[data-state="ready"], .assistant[data-state="error"]');
	await done.waitFor({ timeout: loadTimeout });
	if ((await done.getAttribute('data-state')) === 'error') throw new Error(`the assistant didn't load: ${await page.getByRole('alert').innerText()}`);
}

/** A fresh conversation as this role. */
export async function newConversation(page: Page, role: Role) {
	await page.getByLabel(role === 'staff' ? 'Staff' : 'Student', { exact: true }).check(); // switching clears the chat
	const fresh = page.getByRole('button', { name: 'New conversation' });
	if (await fresh.isEnabled()) await fresh.click();
}

/** Asks one question in the open conversation and waits for the reply (or the error shown instead). */
export async function ask(page: Page, text: string) {
	const answers = page.locator('.log li:not([data-role="user"])');
	const before = await answers.count();
	const t0 = Date.now();
	await page.getByLabel('Your question').fill(text);
	await page.getByRole('button', { name: 'Send' }).click();
	const li = answers.nth(before);
	await li.waitFor({ timeout: ANSWER_TIMEOUT });
	const ms = Date.now() - t0;
	const body = await li.locator('.text').innerText();
	const isError = (await li.getAttribute('data-role')) === 'error';
	const sources = (await li.getAttribute('data-sources'))?.split(',').filter(Boolean) ?? [];
	return { reply: isError ? '' : body, error: isError ? body : undefined, sources, ms };
}

/** Every normal question (as a student), then every case (as its role), each in a new conversation. */
export async function runAll(page: Page, cases: Case[], questions: NormalQuestion[], placeholders: string[], onResult?: (r: Result) => void): Promise<Result[]> {
	const results: Result[] = [];
	const add = (r: Result) => { results.push(r); onResult?.(r); };
	for (const q of questions) {
		await newConversation(page, 'student');
		const a = await ask(page, q.question);
		add({
			id: q.id, kind: 'normal', role: 'student', messages: [q.question], replies: [a.reply], sources: [a.sources], ms: [a.ms], error: a.error,
			pass: a.error ? false : score(normalRule(q), [a.reply], placeholders),
			retrieved: q.doc ? a.sources.includes(q.doc) : null
		});
	}
	for (const c of cases) {
		await newConversation(page, c.role);
		const turns: Awaited<ReturnType<typeof ask>>[] = [];
		for (const m of c.messages) {
			const a = await ask(page, m);
			turns.push(a);
			if (a.error) break;
		}
		const error = turns.find((t) => t.error)?.error;
		add({
			id: c.id, kind: 'case', role: c.role, owasp: c.owasp, split: c.split, messages: c.messages,
			replies: turns.map((t) => t.reply), sources: turns.map((t) => t.sources), ms: turns.map((t) => t.ms), error,
			pass: error ? null : score(c.rule, turns.map((t) => t.reply), placeholders),
			retrieved: null
		});
	}
	return results;
}
