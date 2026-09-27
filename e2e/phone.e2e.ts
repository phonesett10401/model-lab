import { expect, test } from '@playwright/test';

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('the index is the home screen; tapping a plate opens the sheet', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('dialog')).toBeHidden();
		await page.locator('a.plate', { hasText: 'Shape sorter' }).click();
		const sheet = page.getByRole('dialog', { name: 'Shape sorter' });
		await expect(sheet).toBeVisible();
		await expect(sheet.locator('[data-bench-title]')).toHaveText('Shape sorter');
	});

	test('Back closes the sheet', async ({ page }) => {
		await page.goto('/');
		await page.locator('a.plate', { hasText: 'Shape sorter' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.goBack();
		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(page).toHaveURL(/\/$/);
	});

	test('the close button closes the sheet', async ({ page }) => {
		await page.goto('/?entry=draft-shape-sorter');
		await page.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByRole('dialog')).toBeHidden();
	});

	test('an unknown slug opens nothing', async ({ page }) => {
		await page.goto('/?entry=typo');
		await expect(page.getByRole('dialog')).toBeHidden();
	});
});

test.describe('landscape phone', () => {
	test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

	test('uses the inline bench, not a sheet, and does not overflow', async ({ page }) => {
		await page.goto('/?entry=draft-shape-sorter');
		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(page.locator('[data-bench-title]')).toHaveText('Shape sorter');
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(overflow).toBeLessThanOrEqual(0);
	});
});

test.describe('tablet', () => {
	test.use({ viewport: { width: 768, height: 1024 } });

	test('plates form a horizontal strip that scrolls inside itself', async ({ page }) => {
		await page.goto('/');
		const list = page.locator('#archive ul').first();
		const { scroll, client } = await list.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
		expect(scroll).toBeGreaterThan(client);
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(overflow).toBeLessThanOrEqual(0);
	});
});
