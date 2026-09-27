import { expect, test } from '@playwright/test';

test.use({
	viewport: { width: 1280, height: 900 },
	permissions: ['microphone'],
	launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }
});

test('a double-click on Record never leaves a live microphone after Stop', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'fake media devices are Chromium-only');
	await page.addInitScript(() => {
		const w = window as unknown as { streams: MediaStream[] };
		w.streams = [];
		const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
		navigator.mediaDevices.getUserMedia = async (c) => {
			await new Promise((r) => setTimeout(r, 300)); // slow permission prompt
			const s = await orig(c);
			w.streams.push(s);
			return s;
		};
	});
	await page.goto('/?entry=draft-dive-sounds');
	const record = page.getByRole('button', { name: /Record/ });
	await expect(record).toBeEnabled();
	await record.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
	await page.getByRole('button', { name: /Stop/ }).click();
	await expect(page.getByRole('button', { name: /Record/ })).toBeVisible();
	await page.waitForTimeout(400);
	const live = await page.evaluate(() =>
		(window as unknown as { streams: MediaStream[] }).streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length
	);
	expect(live).toBe(0);
});
