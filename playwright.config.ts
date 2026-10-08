import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	webServer: { command: 'pnpm build && pnpm preview --port 4173', port: 4173, reuseExistingServer: !process.env.CI, timeout: 180_000 },
	use: { baseURL: 'http://localhost:4173' },
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: ['**/intro-video.e2e.ts', '**/assistant-real.e2e.ts'] },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: ['**/intro-video.e2e.ts', '**/live.e2e.ts', '**/assistant-real.e2e.ts'] }, // live tests need Chromium's fake microphone
		// Playwright's bundled Chromium can't decode H.264 or run WebGPU models; real playback and the real assistant run in installed Google Chrome.
		{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' }, testMatch: ['**/intro-video.e2e.ts', '**/assistant-real.e2e.ts'] }
	]
});
