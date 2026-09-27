import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 } });

test('Enter plays the video with sound; Mute and Replay work', async ({ page }) => {
	await page.goto('/intro');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: '▶ Enter the lab' }).click();
	const video = page.locator('video');
	await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0.5), { timeout: 5000 }).toBe(true);
	expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);

	await page.getByRole('button', { name: /Mute/ }).click();
	expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);

	await page.getByRole('button', { name: /Replay/ }).click();
	expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(1);
});

test('Skip during playback stops the sound', async ({ page }) => {
	await page.goto('/intro');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: '▶ Enter the lab' }).click();
	const video = page.locator('video');
	await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused), { timeout: 5000 }).toBe(true);
	await page.getByRole('button', { name: /Skip/ }).click();
	expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
});
