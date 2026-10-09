import type { Page } from '@playwright/test';
import type { AssistantSettings } from '../src/lib/assistant/assistants';
import { normalRule, score, unknownNumbers, type Case, type NormalQuestion, type Result } from '../src/lib/assistant/score';

const ANSWER_TIMEOUT = 5 * 60_000; // a slow (integrated) GPU can take minutes per answer

/** Opens an assistant at a version, starts it, and waits until it's ready (the first time includes the download). */
export async function open(page: Page, slug: string, version: string, loadTimeout: number) {
	await page.goto(`/assistant/${encodeURIComponent(slug)}?version=${encodeURIComponent(version)}`);
	const shown = await page.locator('.assistant[data-version]').getAttribute('data-version', { timeout: 60_000 }).catch(() => {
		throw new Error('the assistant page did not finish loading within 60 s (is the site running?)');
	});
	if (shown !== version) throw new Error(`the page has no version "${version}" (add it to VERSIONS in src/lib/assistant/config.ts)`);
	await page.getByRole('button', { name: 'Start the assistant' }).click();
	const done = page.locator('.assistant[data-state="ready"], .assistant[data-state="error"]');
	await done.waitFor({ timeout: loadTimeout });
	if ((await done.getAttribute('data-state')) === 'error') throw new Error(`the assistant didn't load: ${await page.getByRole('alert').innerText()}`);
}

/** A fresh conversation as this role. */
export async function newConversation(page: Page, a: AssistantSettings, role: string) {
	const label = a.roles.find((r) => r.id === role)?.label ?? a.roles[0].label;
	await page.getByLabel(label, { exact: true }).check(); // switching clears the chat
	const fresh = page.getByRole('button', { name: 'New conversation' });
	if (await fresh.isEnabled()) await fresh.click();
}

/** Asks one question in the open conversation and waits for the reply (or the error shown instead; after a lost GPU it reloads the engine). */
export async function ask(page: Page, text: string) {
	const answers = page.locator('.log li:not([data-role="user"])');
	const before = await answers.count();
	const t0 = Date.now();
	await page.getByLabel('Your question').fill(text);
	await page.getByRole('button', { name: 'Send' }).click();
	const li = answers.nth(before);
	const crashed = page.locator('.assistant[data-state="error"]'); // a lost GPU hides the log and offers Try again
	await li.or(crashed).first().waitFor({ timeout: ANSWER_TIMEOUT });
	const ms = Date.now() - t0;
	if (await crashed.count()) {
		const error = await page.getByRole('alert').innerText();
		await page.getByRole('button', { name: 'Try again' }).click();
		await page.locator('.assistant[data-state="ready"]').waitFor({ timeout: 10 * 60_000 }); // reloads from the browser cache
		return { reply: '', error, sources: [] as string[], ms };
	}
	const body = await li.locator('.text').innerText();
	const isError = (await li.getAttribute('data-role')) === 'error';
	const sources = (await li.getAttribute('data-sources'))?.split(',').filter(Boolean) ?? [];
	return { reply: isError ? '' : body, error: isError ? body : undefined, sources, ms };
}

/** Every normal question (as the public role), then every case (as its role), each in a new conversation. */
export async function runAll(page: Page, a: AssistantSettings, cases: Case[], questions: NormalQuestion[], placeholders: string[], known: string[], onResult?: (r: Result) => void): Promise<Result[]> {
	const results: Result[] = [];
	const add = (r: Result) => { results.push(r); onResult?.(r); };
	const numbers = (replies: string[]) => [...new Set(replies.flatMap((r) => unknownNumbers(r, known)))];
	const asPublic = a.roles[0].id;
	for (const q of questions) {
		await newConversation(page, a, asPublic);
		const t = await ask(page, q.question);
		add({
			id: q.id, kind: 'normal', role: asPublic, messages: [q.question], replies: [t.reply], sources: [t.sources], ms: [t.ms], error: t.error,
			pass: t.error ? false : score(normalRule(q), [t.reply], placeholders),
			retrieved: q.doc && !t.error ? t.sources.includes(q.doc) : null,
			unknownNumbers: numbers([t.reply])
		});
	}
	for (const c of cases) {
		await newConversation(page, a, c.role);
		const turns: Awaited<ReturnType<typeof ask>>[] = [];
		for (const m of c.messages) {
			const t = await ask(page, m);
			turns.push(t);
			if (t.error) break;
		}
		const error = turns.find((t) => t.error)?.error;
		const replies = turns.map((t) => t.reply);
		const scored = score(c.rule, replies, placeholders);
		const leakRule = c.rule.type === 'no_placeholders' || c.rule.type === 'contains_none';
		add({
			id: c.id, kind: 'case', role: c.role, owasp: c.owasp, split: c.split, messages: c.messages,
			replies, sources: turns.map((t) => t.sources), ms: turns.map((t) => t.ms), error,
			pass: error ? (leakRule && scored === false ? false : null) : scored, // a leak before the error still counts
			retrieved: null,
			unknownNumbers: numbers(replies)
		});
	}
	return results;
}
