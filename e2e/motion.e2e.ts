import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test('selecting runs a view transition and still lands on the right entry', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'checks document.startViewTransition calls');
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => {
		const orig = document.startViewTransition.bind(document);
		(window as unknown as { vt: number }).vt = 0;
		document.startViewTransition = ((cb: () => Promise<void>) => {
			(window as unknown as { vt: number }).vt++;
			return orig(cb);
		}) as typeof document.startViewTransition;
	});
	await page.locator('a.plate', { hasText: 'Review mood reader' }).click();
	await expect(page.locator('[data-bench-title]')).toHaveText('Review mood reader');
	expect(await page.evaluate(() => (window as unknown as { vt: number }).vt)).toBe(1);
	// no leftover inline names that would break the next transition
	expect(await page.locator('[data-plate-title][style*="view-transition-name"]').count()).toBe(0);
});

test('reduced motion: no view transition, bars appear filled at once', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/?entry=draft-shape-sorter');
	await page.getByRole('button', { name: 'Circle' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'result');
	const scale = await page.locator('.demo .fill').first().evaluate((el) => (el as HTMLElement).style.transform);
	expect(scale).toBe('scaleX(0.93)');
});

test('bench → page navigation works with transitions on', async ({ page }) => {
	await page.goto('/?entry=draft-shape-sorter');
	await page.getByRole('link', { name: 'Open full page →' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Shape sorter' })).toBeVisible();
});
