import { expect, test } from '@playwright/test';

test('the gate shows the title, Enter, and Skip', async ({ page }) => {
	await page.goto('/intro');
	await expect(page.getByText('Explore the lab.')).toBeVisible();
	await expect(page.getByRole('button', { name: '▶ Enter the lab' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Skip intro →' })).toBeVisible();
	await expect(page).toHaveTitle('Intro · AI Model Lab');
});

test('portrait phones get the tall video; desktops get wide', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/intro');
	await expect(page.locator('video')).toHaveAttribute('src', '/intro/intro-tall.mp4');
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/intro');
	await expect(page.locator('video')).toHaveAttribute('src', '/intro/intro-wide.mp4');
});

test('if the browser refuses playback, native controls appear instead of freezing', async ({ page }) => {
	await page.addInitScript(() => {
		HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
	});
	await page.goto('/intro');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: '▶ Enter the lab' }).click();
	await expect(page.locator('video')).toHaveAttribute('controls', '');
	await expect(page.getByText(/press play/i)).toBeVisible();
});

test('reduced motion offers "Read instead"', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/intro');
	await expect(page.getByRole('button', { name: 'Read instead' })).toBeVisible();
});
