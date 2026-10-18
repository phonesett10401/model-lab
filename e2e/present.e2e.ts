import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ viewport: { width: 1280, height: 720 } });
// Playwright's Chromium can't decode H.264; playback itself is the browser's job, the deck only needs play() to resolve.
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
});

const deck = (page: Page) => page.locator('main.present');
const at = (page: Page, i: number) => expect(deck(page)).toHaveAttribute('data-index', String(i));
async function start(page: Page) {
	await page.goto('/present');
	await page.getByRole('button', { name: '▶ Start the presentation' }).click();
	await at(page, 0);
}

test('the gate shows the start button and the title', async ({ page }) => {
	await page.goto('/present');
	await expect(page.getByRole('button', { name: '▶ Start the presentation' })).toBeVisible();
	await expect(page).toHaveTitle('Presentation · AI Model Lab');
});

test('Space on the focused start button starts once', async ({ page }) => {
	await page.goto('/present');
	await page.getByRole('button', { name: '▶ Start the presentation' }).focus();
	await page.keyboard.press('Space');
	await at(page, 0);
	await expect(page.locator('video.intro')).toBeVisible();
	await page.keyboard.press('Space');
	await at(page, 1);
});

test('the intro holds its last frame until a press', async ({ page }) => {
	await start(page);
	await page.locator('video.intro').dispatchEvent('ended');
	await page.waitForTimeout(300);
	await at(page, 0);
	await page.keyboard.press('ArrowDown');
	await at(page, 1);
});

test('arrows, PageUp/PageDown, Home and End move one slide', async ({ page }) => {
	await start(page);
	await page.keyboard.press('ArrowDown');
	await at(page, 1);
	await page.keyboard.press('PageDown');
	await at(page, 2);
	await page.keyboard.press('ArrowRight');
	await at(page, 3);
	await page.keyboard.press('ArrowUp');
	await at(page, 2);
	await page.keyboard.press('End');
	await at(page, 9);
	await expect(page.locator('section.slide[aria-current="step"] .counter')).toHaveText('LIVE 09 / 09');
	await page.keyboard.press('Home');
	await at(page, 1);
	await page.keyboard.press('ArrowLeft');
	await at(page, 1);
});

test('mashing Space never skips past the last slide', async ({ page }) => {
	await start(page);
	await page.keyboard.press('End');
	for (let i = 0; i < 5; i++) await page.keyboard.press('Space');
	await at(page, 9);
});

test('a hash opens that slide directly', async ({ page }) => {
	await page.goto('/present#5');
	await at(page, 5);
	await expect(page.getByRole('button', { name: '▶ Start the presentation' })).toHaveCount(0);
	await page.keyboard.press('ArrowDown');
	await expect.poll(() => page.evaluate(() => location.hash)).toBe('#6');
});

test('the top bar links to the presentation', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Present' })).toHaveAttribute('href', '/present');
});

const sizes = [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }];

test('every slide fits at 1280×720 and 1920×1080', async ({ page }) => {
	for (const size of sizes) {
		await page.setViewportSize(size);
		await page.goto('/present#1');
		for (let n = 1; n <= 9; n++) {
			await at(page, n);
			await page.waitForTimeout(1300); // let the entrance finish
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `slide ${n} at ${size.width}`).toBe(true);
			const box = (await page.locator('section.slide[aria-current="step"] .copy').boundingBox())!;
			expect(box.y + box.height, `slide ${n} copy bottom at ${size.width}`).toBeLessThanOrEqual(size.height);
			expect(box.x + box.width, `slide ${n} copy right at ${size.width}`).toBeLessThanOrEqual(size.width);
			await page.keyboard.press('ArrowDown');
		}
	}
	// projector switch: the dot canvas follows the window
	await expect.poll(() => page.locator('.stage canvas').evaluate((c) => Math.round(c.getBoundingClientRect().width))).toBe(1280);
});

test('each slide uses its banner layout', async ({ page }) => {
	const layouts = ['slant', 'monitor', 'band', 'strip', 'slant', 'strip', 'band', 'slant', 'monitor'];
	for (let n = 1; n <= 9; n++) {
		await page.goto(`/present#${n}`);
		await expect(page.locator('section.slide[aria-current="step"] .banner')).toHaveAttribute('data-layout', layouts[n - 1]);
	}
});

test('result slides show measured numbers', async ({ page }) => {
	await page.goto('/present#5');
	await expect(page.locator('section.slide[aria-current="step"] .stat')).toContainText('0.74', { timeout: 3000 });
	await expect(page.getByText('BUILT ✓')).toBeVisible();
	await page.goto('/present#6');
	await expect(page.locator('section.slide[aria-current="step"] .stat')).toContainText('0.79', { timeout: 3000 });
});

test('reduced motion shows finished slides', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/present#5');
	await expect(page.locator('section.slide[aria-current="step"] .stat')).toContainText('0.74', { timeout: 300 });
});

test('the presenter tag shows on every slide', async ({ page }) => {
	await page.goto('/present#1');
	for (let n = 1; n <= 9; n++) {
		await expect(page.locator('section.slide[aria-current="step"] .lower')).toContainText('NOW PRESENTING');
		await page.keyboard.press('ArrowDown');
	}
});

test('present has no axe violations', async ({ page }) => {
	for (const n of [1, 5, 9]) {
		await page.goto(`/present#${n}`);
		// axe blends mid-fade text with the stage, so wait until the entrance has finished
		await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a instanceof CSSTransition).length)).toBe(0);
		const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
		expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((x) => `${x.target} ${x.any.map((a) => a.message).join()}`).join(' ')}`), `slide ${n}`).toEqual([]);
	}
});

test('slide 9 shows a QR for the site and its address', async ({ page }) => {
	await page.goto('/present#9');
	const qr = page.locator('section.slide[aria-current="step"] .qr');
	await expect(qr.locator('svg')).toBeVisible();
	await expect(qr).toHaveAttribute('data-origin', 'http://localhost:4173');
	const box = (await qr.locator('svg').boundingBox())!;
	expect(box.height).toBeGreaterThanOrEqual(0.28 * 720);
	await expect(qr.getByText('localhost:4173')).toBeVisible();
});

test('a missing banner video falls back to its poster', async ({ page }) => {
	await page.route('**/present/sea.mp4', (r) => r.abort());
	await page.goto('/present#5');
	await expect(page.locator('section.slide[aria-current="step"] .banner video')).toHaveAttribute('poster', '/present/sea.jpg');
	await page.keyboard.press('ArrowDown');
	await at(page, 6);
});

test('/ never loads presentation assets', async ({ page }) => {
	const urls: string[] = [];
	page.on('request', (r) => urls.push(r.url()));
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	expect(urls.filter((u) => u.includes('/present/'))).toEqual([]);
});

test('the start screen preloads every banner', async ({ page }) => {
	const urls: string[] = [];
	page.on('request', (r) => urls.push(r.url()));
	await page.goto('/present');
	await expect(page.getByText('Ready')).toBeVisible({ timeout: 30_000 });
	for (const id of ['swarm', 'boxes', 'pipeline', 'device', 'sea', 'sound', 'rag', 'coming', 'site'])
		expect(urls.some((u) => u.endsWith(`/present/${id}.mp4`)), id).toBe(true);
});
