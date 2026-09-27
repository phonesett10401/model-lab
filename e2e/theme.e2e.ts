import { expect, test } from '@playwright/test';

const bg = (page: import('@playwright/test').Page) =>
	page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('follows the device, then remembers the toggle', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	expect(await bg(page)).toBe('rgb(20, 18, 19)');

	await page.getByRole('button', { name: 'Switch to light theme' }).click();
	expect(await bg(page)).toBe('rgb(245, 243, 242)');

	await page.reload();
	expect(await bg(page)).toBe('rgb(245, 243, 242)');
	await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
});

test('fonts are self-hosted', async ({ page }) => {
	const external: string[] = [];
	page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url()); });
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	expect(external).toEqual([]);
});
