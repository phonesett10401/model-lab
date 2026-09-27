import { expect, test } from '@playwright/test';

const bg = (page: import('@playwright/test').Page) =>
	page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('follows the device, then remembers the toggle', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	expect(await bg(page)).toBe('rgb(20, 18, 19)');

	await page.getByRole('button', { name: 'Switch to Paper theme' }).click();
	expect(await bg(page)).toBe('rgb(245, 243, 242)');

	await page.reload();
	expect(await bg(page)).toBe('rgb(245, 243, 242)');
	await expect(page.getByRole('button', { name: 'Switch to Evening theme' })).toBeVisible();
});

test('fonts are self-hosted', async ({ page }) => {
	const external: string[] = [];
	page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url()); });
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	expect(external).toEqual([]);
});

test('the toggle accessible name contains its visible word (voice control)', async ({ page }) => {
	await page.goto('/');
	const btn = page.locator('.topbar button');
	const visible = await btn.evaluate((el) => {
		const c = el.cloneNode(true) as HTMLElement;
		c.querySelectorAll('.visually-hidden, [aria-hidden="true"]').forEach((n) => n.remove());
		return (c.textContent ?? '').trim();
	});
	expect(visible).toMatch(/^(Paper|Evening)$/);
	await expect(btn).toHaveAccessibleName(new RegExp(visible));
});
