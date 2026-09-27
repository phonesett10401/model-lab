import { expect, test } from '@playwright/test';

test.describe('small phone', () => {
	test.use({ viewport: { width: 320, height: 640 }, hasTouch: true });

	test('the answer scrolls into view', async ({ page }) => {
		await page.goto('/?entry=draft-plant-watering');
		await page.getByRole('button', { name: 'Dry and hot' }).click();
		await expect(page.locator('.answer')).toBeInViewport();
	});
});

for (const vp of [{ width: 768, height: 1024 }, { width: 844, height: 390 }])
	test(`input and result sit side by side @${vp.width}x${vp.height}`, async ({ page }) => {
		await page.setViewportSize(vp);
		await page.goto('/?entry=draft-shape-sorter');
		await page.getByRole('button', { name: 'Circle' }).click();
		await expect(page.locator('.demo')).toHaveAttribute('data-state', 'result');
		const input = await page.locator('.demo .drop').boundingBox();
		const out = await page.locator('.demo .out').boundingBox();
		expect(out!.x).toBeGreaterThanOrEqual(input!.x + input!.width - 1);
	});

test('tapping a hero dot stops the rotation for good', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	await page.getByRole('button', { name: 'Show text sample' }).click();
	const hero = page.getByRole('figure', { name: /Sample specimen/ });
	await page.mouse.move(0, 0); // leave the figure: hover pause no longer applies
	await page.clock.fastForward(12000);
	await expect(hero).toHaveAttribute('data-kind', 'text');
});
