import { expect, test } from '@playwright/test';

test('home renders', async ({ page }) => {
	const res = await page.goto('/');
	expect(res?.status()).toBe(200);
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('navigation', { name: 'Archive index' })).toBeVisible();
});
