import { expect, test } from '@playwright/test';

const widths = [320, 375, 390, 768, 1024, 1280, 1440, 1920, 2560];
const paths = ['/', '/?entry=draft-plant-watering', '/models/draft-shape-sorter', '/audits/draft-document-assistant-audit', '/no-such-page', '/intro', '/assistant/raffel-luo', '/assistant/pathum-rai'];
const name = (p: string) => p.replace(/[^a-z0-9]+/gi, '_') || 'home';

for (const w of widths)
	for (const scheme of ['light', 'dark'] as const)
		test(`no overflow @${w} ${scheme}`, async ({ page, browserName }) => {
			test.skip(browserName !== 'chromium', 'screenshots from one engine');
			await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
			await page.setViewportSize({ width: w, height: 900 });
			for (const p of paths) {
				await page.goto(p);
				await page.evaluate(() => document.fonts.ready);
				const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
				expect(overflow, `${p} overflows at ${w}px`).toBeLessThanOrEqual(0);
				await page.screenshot({ path: `test-results/sizes/${w}-${scheme}-${name(p)}.png`, fullPage: true });
			}
		});

test('200% text zoom at 320px does not overflow', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'one engine is enough');
	await page.setViewportSize({ width: 320, height: 800 });
	await page.goto('/models/draft-plant-watering');
	await page.addStyleTag({ content: 'html { font-size: 200%; }' });
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBeLessThanOrEqual(0);
});

test('tap targets are at least 44px on a phone', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'one engine is enough');
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/?entry=draft-shape-sorter');
	const small = await page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('dialog[open] button, dialog[open] a, main a.plate, .topbar button')]
			.filter((el) => el.offsetParent !== null)
			.map((el) => ({ el: el.textContent?.trim() || el.getAttribute('aria-label'), ...el.getBoundingClientRect().toJSON() }))
			.filter((r) => r.height < 44)
			.map((r) => `${r.el} (${Math.round(r.height)}px)`)
	);
	expect(small).toEqual([]);
});
