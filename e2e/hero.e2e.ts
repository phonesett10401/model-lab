import { expect, test } from '@playwright/test';

test('the hero is labelled SAMPLE and cycles specimen kinds', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	const hero = page.getByRole('figure', { name: /Sample specimen/ });
	await expect(hero.getByText('SAMPLE', { exact: true })).toBeVisible();
	await expect(hero).toHaveAttribute('data-kind', 'image');
	await page.clock.fastForward(5100);
	await expect(hero).toHaveAttribute('data-kind', 'text');
});

test('reduced motion keeps the hero still', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.clock.install();
	await page.goto('/');
	const hero = page.getByRole('figure', { name: /Sample specimen/ });
	await page.clock.fastForward(12000);
	await expect(hero).toHaveAttribute('data-kind', 'image');
});

test('the hero links to the archive', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('See what it sees.');
	await page.getByRole('link', { name: 'Open the archive ↓' }).click();
	await expect(page).toHaveURL(/#archive$/);
});
