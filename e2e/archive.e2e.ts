import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test('shows the first entry by default and selects on click', async ({ page }) => {
	await page.goto('/');
	const bench = page.locator('[data-bench-title]');
	await expect(bench).toHaveText('Sea creature detector');
	await page.locator('a.plate', { hasText: 'Review mood reader' }).click();
	await expect(page).toHaveURL(/\?entry=draft-review-mood/);
	await expect(bench).toHaveText('Review mood reader');
	await expect(page.locator('a.plate[aria-current="true"]')).toContainText('Review mood reader');
});

test('an unknown slug falls back to the first entry', async ({ page }) => {
	await page.goto('/?entry=typo-slug');
	await expect(page.locator('[data-bench-title]')).toHaveText('Sea creature detector');
});

test('a shared link opens that entry', async ({ page }) => {
	await page.goto('/?entry=draft-document-assistant-audit');
	await expect(page.locator('[data-bench-title]')).toHaveText('Document assistant audit');
});

test('keyboard: arrows move, Enter opens the page', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle'); // handlers attach on hydration
	await page.locator('a.plate').first().focus();
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('[data-bench-title]')).toHaveText('Fresh or spoiled');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/models\/fresh-or-spoiled$/);
});

test('back button returns to the previous selection', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	const bench = page.locator('[data-bench-title]');
	await page.locator('a.plate', { hasText: 'Shape sorter' }).click();
	await expect(bench).toHaveText('Shape sorter'); // let each navigation land before the next
	await page.locator('a.plate', { hasText: 'Dive sound sorter' }).click();
	await expect(bench).toHaveText('Dive sound sorter');
	await page.goBack();
	await expect(page.locator('[data-bench-title]')).toHaveText('Shape sorter');
});

test('audits are grouped separately', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Audits' })).toBeVisible();
	await expect(page.locator('a.plate', { hasText: 'Document assistant audit' })).toContainText('Audit');
	await expect(page.locator('a.plate', { hasText: 'Gender classifier' })).toContainText('Image'); // a model now
});

test('on a short laptop screen every plate in the index stays reachable without an inner scroll', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 700 });
	await page.goto('/');
	const clipped = await page.locator('#archive').evaluate((el) => el.scrollHeight - el.clientHeight);
	expect(clipped).toBeLessThanOrEqual(0);
});

test('the home page is the models section; the assistants have their own section', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	const headings = await page.locator('#archive h2').allInnerTexts();
	expect(headings.map((h) => h.trim().toUpperCase())).toEqual(['MODELS', 'AUDITS']);
	const tabs = page.getByRole('navigation', { name: 'Sections' });
	await expect(tabs.getByRole('link', { name: 'Models' })).toHaveAttribute('aria-current', 'page');
	await tabs.getByRole('link', { name: 'RAG assistants' }).click();
	await expect(page).toHaveURL(/\/assistants$/);
	await expect(tabs.getByRole('link', { name: 'RAG assistants' })).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Ask it. Attack it.');
	await expect(page.locator('[data-bench-title]')).toHaveText(['University of Raffel Luo assistant', 'Pathum Rai District assistant']);
	await page.getByRole('link', { name: 'Open the assistant' }).nth(1).click();
	await expect(page).toHaveURL(/\/assistant\/pathum-rai$/);
	await expect(tabs.getByRole('link', { name: 'RAG assistants' })).toHaveAttribute('aria-current', 'page');
});

test('the assistants banner shows each audit’s measured leak rates and links to it', async ({ page }) => {
	await page.goto('/assistants');
	const board = page.getByRole('figure', { name: /Attacks that leaked/ });
	await expect(board.getByRole('heading', { name: 'Pathum Rai District' })).toBeVisible();
	await expect(board.locator('li[aria-label^="v0,"]').first()).toBeVisible();
	await expect(board.getByRole('link', { name: 'Read the full audit' }).first()).toHaveAttribute('href', /\/audits\//);
});

test('an old shared link to an assistant forwards to its section; nothing downloads there', async ({ page, baseURL }) => {
	const offsite: string[] = [];
	page.on('request', (r) => { if (!r.url().startsWith(baseURL!)) offsite.push(r.url()); });
	await page.goto('/?entry=raffel-luo');
	await expect(page).toHaveURL(/\/assistants$/);
	await page.waitForLoadState('networkidle');
	expect(offsite).toEqual([]);
});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });
	test('the section tabs fit and the assistant cards stack', async ({ page }) => {
		await page.goto('/assistants');
		await expect(page.getByRole('link', { name: 'Open the assistant' })).toHaveCount(2);
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(overflow).toBeLessThanOrEqual(0);
	});
});

test('/assistants shares its own preview image', async ({ page }) => {
	await page.goto('/assistants');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/assistants\.png$/);
});
