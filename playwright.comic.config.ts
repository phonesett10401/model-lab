import { defineConfig, devices } from '@playwright/test';

// The comic translator's pipeline evaluation (pnpm eval:comic): the real page on the dev server, so /api/translate is
// the real handler and calls Gemini with the text of open-licence test pages. Port 4181: 4173 belongs to the RAG runner.
export default defineConfig({
	testDir: 'eval',
	testMatch: 'comic.eval.ts',
	timeout: 0,
	workers: 1,
	reporter: 'list',
	webServer: { command: 'pnpm dev --port 4181 --strictPort', port: 4181, reuseExistingServer: false, timeout: 180_000 },
	use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1600 }, baseURL: 'http://localhost:4181' }
});
