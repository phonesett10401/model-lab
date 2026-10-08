import { defineConfig, devices } from '@playwright/test';

// The evaluation runner: installed Chrome (WebGPU on the real GPU), a visible window, one page, no time limit.
export default defineConfig({
	testDir: 'eval',
	testMatch: '*.eval.ts',
	timeout: 0,
	workers: 1,
	reporter: 'list',
	webServer: { command: 'pnpm build && pnpm preview --port 4173', port: 4173, reuseExistingServer: true, timeout: 180_000 },
	use: { ...devices['Desktop Chrome'], channel: 'chrome', headless: false, baseURL: 'http://localhost:4173' }
});
