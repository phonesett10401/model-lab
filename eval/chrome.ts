import { test as base, chromium } from '@playwright/test';

/**
 * Installed Chrome with a real profile folder. Playwright's default throw-away context behaves like a private
 * window: its storage quota is too small for the ~1 GB model (QuotaExceededError), and nothing is kept between runs.
 * A profile folder fixes both: the model downloads once and later runs reuse it.
 */
export const test = base.extend({
	context: async ({ baseURL, headless }, use) => {
		const context = await chromium.launchPersistentContext('.chrome-profile', { channel: 'chrome', headless, baseURL });
		await use(context);
		await context.close();
	}
});
