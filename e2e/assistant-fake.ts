import type { Page } from '@playwright/test';

/**
 * Drives /assistant without a GPU. load() reports 40%, then (if hold) waits for releaseLoad().
 * failLoads: one error message per failing load, in order. replies: scripted answers by question.
 * Otherwise chat answers 'Reply to "<question>" as <role>'; the question FAIL throws, OOM throws an out-of-memory error,
 * and HOLD waits for releaseChat().
 * embed() scores "library" texts apart from the rest, so retrieval is predictable.
 */
export async function useFakeEngine(page: Page, opts: { hold?: boolean; failLoads?: string[]; replies?: Record<string, string> } = {}) {
	await page.addInitScript(({ hold, failLoads, replies }) => {
		const w = window as any;
		let loads = 0;
		const released = new Promise((r) => (w.__releaseLoad = r));
		const chatHeld = new Promise((r) => (w.__releaseChat = r));
		w.__assistantEngine = {
			async load(onProgress: (p: number, t: string) => void) {
				onProgress(0.4, 'Fetching param cache[1/2]');
				if (hold) await released;
				if (loads < failLoads.length) throw new Error(failLoads[loads++]);
			},
			async embed(texts: string[]) {
				return texts.map((t) => [/library/i.test(t) ? 1 : 0, 1]);
			},
			async chat(messages: { role: string; content: string }[]) {
				const q = messages.at(-1)!.content;
				if (q in replies) return replies[q];
				if (q === 'FAIL') throw new Error('boom');
				if (q === 'OOM') throw new Error('GPUOutOfMemoryError: out of memory');
				if (q === 'HOLD') await chatHeld;
				return `Reply to "${q}" as ${messages[0].content.includes('signed in as a staff member') ? 'staff' : 'student'}`;
			}
		};
	}, { hold: opts.hold ?? false, failLoads: opts.failLoads ?? [], replies: opts.replies ?? {} });
}

export const releaseChat = (page: Page) => page.evaluate(() => (window as any).__releaseChat());
export const releaseLoad = (page: Page) => page.evaluate(() => (window as any).__releaseLoad());

/** Starts the (fake) assistant and waits until it's ready. */
export async function startFake(page: Page) {
	await page.getByRole('button', { name: 'Start the assistant' }).click();
	await page.locator('.assistant[data-state="ready"]').waitFor();
}

export async function askFake(page: Page, text: string) {
	await page.getByLabel('Your question').fill(text);
	await page.getByRole('button', { name: 'Send' }).click();
}
