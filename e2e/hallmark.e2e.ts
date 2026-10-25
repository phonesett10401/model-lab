import { expect, test } from '@playwright/test';

// Fixes from the Hallmark audit (docs: the audit run on 2026-10-25).
const pages = ['/', '/assistants', '/assistant/pathum-rai', '/audits/pathum-rai', '/models/sea-creature-detector', '/models/sound-detective', '/intro', '/present'];

test('no emoji or picture characters stand in for icons', async ({ page }) => {
	for (const path of pages) {
		await page.goto(path);
		const text = await page.evaluate(() => document.body.innerText);
		expect(text.match(/(?![©®™])\p{Extended_Pictographic}|[▶◀☀☾]/gu), path).toBeNull();
	}
});

test('the page never scrolls sideways: html and body clip horizontal overflow', async ({ page }) => {
	await page.goto('/');
	const clip = await page.evaluate(() => [document.documentElement, document.body].map((el) => getComputedStyle(el).overflowX));
	expect(clip).toEqual(['clip', 'clip']);
});

test('the skip link is hidden without being parked off screen, and shows on focus', async ({ page }) => {
	await page.goto('/');
	const skip = page.getByRole('link', { name: 'Skip to content' });
	expect((await skip.boundingBox())!.x).toBeGreaterThanOrEqual(0);
	await skip.focus(); // WebKit doesn't Tab to links by default
	await expect(skip).toBeFocused();
	expect((await skip.boundingBox())!.width).toBeGreaterThan(40);
});

test.describe('at 320px', () => {
	test.use({ viewport: { width: 320, height: 700 } });
	test('the wordmark and header links stay on one line', async ({ page }) => {
		await page.goto('/');
		for (const name of ['AI MODEL LAB', 'Present', /intro/]) {
			const link = page.locator('header').getByRole('link', { name });
			const lines = await link.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || '20')));
			expect(await link.evaluate((el) => getComputedStyle(el).whiteSpace), String(name)).toBe('nowrap');
			expect(lines, String(name)).toBeLessThanOrEqual(2); // 44px tap target over one line of text
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
	});
});

test('the audit summary keeps a readable measure (75 characters a line at most)', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/audits/pathum-rai');
	const perLine = await page.locator('.summary').evaluate((el) => {
		const lines = el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight);
		return el.textContent!.length / Math.round(lines);
	});
	expect(perLine).toBeLessThanOrEqual(75);
});
