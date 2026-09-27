import { expect, test } from '@playwright/test';

test('404 page is in the archive style and leads home', async ({ page }) => {
	const res = await page.goto('/no/such/page');
	expect(res?.status()).toBe(404);
	await expect(page.getByText('MISSING', { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Specimen not found');
	await page.getByRole('link', { name: 'Back to the archive' }).click();
	await expect(page).toHaveURL(/\/$/);
});

test('home has a link preview', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/home\.png$/);
});
