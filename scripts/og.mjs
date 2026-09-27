// Screenshots /og-card/* into static/og/*.png. Run against a production build:
//   pnpm build && pnpm preview --port 4173   (in another terminal)
//   pnpm og
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce' }); // stamps ink in; capture them settled
await page.goto(`${base}/og-card`);
const slugs = (await page.locator('a').allTextContents()).filter((s) => !s.startsWith('draft-'));
mkdirSync('static/og', { recursive: true });
for (const slug of slugs) {
	await page.goto(`${base}/og-card/${slug}`);
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: `static/og/${slug}.png` });
	console.log(`static/og/${slug}.png`);
}
await browser.close();
