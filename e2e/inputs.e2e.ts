import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });
const demo = (page: import('@playwright/test').Page) => page.locator('.demo');

test('text: typing and examining', async ({ page }) => {
	await page.goto('/?entry=draft-review-mood');
	const box = page.getByLabel('Type or paste text');
	await expect(page.getByRole('button', { name: 'Examine' })).toBeDisabled();
	await box.fill('What a lovely reef.');
	await expect(page.getByText('19 / 2000')).toBeVisible();
	await page.getByRole('button', { name: 'Examine' }).click();
	await expect(demo(page)).toHaveAttribute('data-state', /result|unsure/);
});

test('text: a long paste is capped at the limit', async ({ page }) => {
	await page.goto('/?entry=draft-review-mood');
	await page.getByLabel('Type or paste text').fill('x'.repeat(5000));
	await expect(page.getByText('2000 / 2000')).toBeVisible();
});

test('text: a sample fills the box and runs', async ({ page }) => {
	await page.goto('/?entry=draft-review-mood');
	await page.getByRole('button', { name: /Sarcasm/ }).click();
	await expect(page.getByLabel('Type or paste text')).toHaveValue('Oh great, another delayed boat. Fantastic.');
	await expect(demo(page)).toHaveAttribute('data-state', 'result');
	await expect(page.locator('.answer')).toHaveText('positive');
});

test('table: the form validates and runs', async ({ page }) => {
	await page.goto('/?entry=draft-plant-watering');
	await page.getByRole('button', { name: 'Examine' }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'ready'); // invalid form, nothing ran
	await page.getByLabel('Soil moisture (%)').fill('40');
	await page.getByLabel('Temperature (°C)').fill('20');
	await page.getByLabel('Pot size').selectOption('medium');
	await page.getByRole('button', { name: 'Examine' }).click();
	await expect(demo(page)).toHaveAttribute('data-state', /result|unsure/);
});

test('audio: a sample shows a waveform and runs', async ({ page }) => {
	await page.goto('/?entry=draft-dive-sounds');
	await page.getByRole('button', { name: 'Whale call' }).click();
	// Playwright's Windows WebKit has no Web Audio (real Safari does): no waveform there, but it still runs.
	if (await page.evaluate(() => typeof AudioContext !== 'undefined')) await expect(page.locator('.wave i').first()).toBeVisible();
	await expect(demo(page)).toHaveAttribute('data-state', 'result');
	await expect(page.locator('.answer')).toHaveText('whale');
});

test('audio: a blocked microphone explains itself and upload still works', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'permission emulation is Chromium-only');
	await page.context().clearPermissions();
	await page.goto('/?entry=draft-dive-sounds');
	await page.getByRole('button', { name: 'Record' }).click();
	await expect(page.getByRole('alert')).toContainText(/microphone|Upload a file/i);
	await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled();
});
