import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 } });

// The audit's D3 bar (4%, not 0) sits well below the fold. Its fill's scaleX, and the value it should reach.
const lastBar = async (page: Page) => {
	const bar = page.locator('li.bar[aria-label^="D3,"]').last();
	const want = await bar.getAttribute('aria-label').then((l) => Number(/(\d+) percent/.exec(l!)![1]) / 100);
	const now = () => bar.locator('.fill').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
	return { bar, want, now };
};

test('a bar below the fold waits at zero, then grows to its value once scrolled into view', async ({ page }) => {
	await page.goto('/audits/pathum-rai');
	await page.waitForLoadState('networkidle');
	const { bar, want, now } = await lastBar(page);
	expect(want).toBeGreaterThan(0);
	await expect.poll(now).toBe(0); // once hydrated
	await bar.scrollIntoViewIfNeeded();
	await expect.poll(now).toBeCloseTo(want, 2);
});

test('without JavaScript every bar is drawn at its value', async ({ browser }) => {
	const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
	await page.goto('/audits/pathum-rai');
	const { want, now } = await lastBar(page);
	expect(await now()).toBeCloseTo(want, 2);
	await page.close();
});

test('with reduced motion a bar below the fold is already at its value', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/audits/pathum-rai');
	await page.waitForLoadState('networkidle');
	const { want, now } = await lastBar(page);
	expect(await now()).toBeCloseTo(want, 2);
});

test('motion timings come from the shared tokens', async ({ page }) => {
	await page.goto('/');
	const t = await page.evaluate(() => {
		const s = getComputedStyle(document.documentElement);
		return ['--dur-micro', '--dur-short', '--dur-long'].map((n) => parseFloat(s.getPropertyValue(n)) * (s.getPropertyValue(n).trim().endsWith('ms') ? 1 : 1000));
	});
	expect(t).toEqual([120, 220, 420]);
	const btn = await page.locator('.btn').first().evaluate((el) => getComputedStyle(el).transitionDuration);
	expect(btn.split(', ').every((d) => d === '0.12s')).toBe(true);
});
