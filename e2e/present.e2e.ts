import { expect, test, type Page } from '@playwright/test';

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
	await expect(page.locator('.counter')).toHaveText('LIVE 09 / 09');
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
