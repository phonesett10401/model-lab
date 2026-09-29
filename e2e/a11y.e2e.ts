import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const paths = ['/', '/?entry=draft-review-mood', '/models/sea-creature-detector', '/models/sound-detective', '/models/draft-dive-sounds', '/audits/draft-document-assistant-audit', '/no-such-page', '/intro'];

for (const scheme of ['light', 'dark'] as const)
	for (const p of paths)
		test(`axe: ${p} (${scheme})`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
			await page.goto(p);
			await page.waitForLoadState('networkidle'); // scan the settled page, not the disabled→enabled switch
			const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
			expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
		});

for (const scheme of ['light', 'dark'] as const)
	test(`axe: the detector after a result (${scheme})`, async ({ page }) => {
		test.setTimeout(90_000);
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
		await page.goto('/models/sea-creature-detector');
		await page.getByRole('button', { name: 'Aquarium tank', exact: true }).click();
		await expect(page.locator('.demo')).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
		await expect(page.locator('.drop .tag').first()).toBeVisible(); // the boxes, tags, list and credit are all on screen
		const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
		expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
	});

for (const scheme of ['light', 'dark'] as const)
	test(`axe: the sound detective after a result (${scheme})`, async ({ page, browserName }) => {
		test.skip(browserName === 'webkit', 'Windows WebKit has no Web Audio');
		test.setTimeout(90_000);
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
		await page.goto('/models/sound-detective');
		const first = JSON.parse(readFileSync('src/lib/data/sound-detective.json', 'utf8')).samples[0];
		await page.getByRole('button', { name: first.title, exact: true }).click();
		await expect(page.locator('.demo')).toHaveAttribute('data-state', /result|unsure/, { timeout: 60_000 });
		await expect(page.locator('.events li').first()).toBeVisible(); // lanes, list, credit all on screen
		const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
		expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
	});

test('keyboard only: reach the archive, run a sample, open the page', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/?entry=draft-shape-sorter');
	await page.getByRole('button', { name: 'Circle' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'result');
	await page.getByRole('link', { name: 'Open full page →' }).focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/models\/draft-shape-sorter$/);
});
