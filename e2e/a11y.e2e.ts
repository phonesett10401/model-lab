import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const paths = ['/', '/?entry=draft-review-mood', '/models/sea-creature-detector', '/models/draft-dive-sounds', '/audits/draft-document-assistant-audit', '/no-such-page', '/intro'];

for (const scheme of ['light', 'dark'] as const)
	for (const p of paths)
		test(`axe: ${p} (${scheme})`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
			await page.goto(p);
			await page.waitForLoadState('networkidle'); // scan the settled page, not the disabled→enabled switch
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
