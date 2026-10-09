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
	await expect(page.locator('a.plate', { hasText: 'Document assistant audit' })).toContainText('AUDIT');
	await expect(page.locator('a.plate', { hasText: 'Gender classifier' })).toContainText('IMAGE'); // a model now
});

test('on a short laptop screen every plate in the index stays reachable without an inner scroll', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 700 });
	await page.goto('/');
	const clipped = await page.locator('#archive').evaluate((el) => el.scrollHeight - el.clientHeight);
	expect(clipped).toBeLessThanOrEqual(0);
});

test('RAG assistants have their own group, a card, and open their page', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'RAG assistants' })).toBeVisible();
	const headings = await page.locator('#archive h2').allInnerTexts();
	expect(headings.map((h) => h.trim().toUpperCase())).toEqual(['MODELS', 'RAG ASSISTANTS', 'AUDITS']);
	await page.locator('a.plate', { hasText: 'Pathum Rai District assistant' }).click();
	await expect(page).toHaveURL(/\?entry=pathum-rai/);
	await expect(page.locator('[data-bench-title]')).toHaveText('Pathum Rai District assistant');
	await expect(page.getByText('Citizen / Officer')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open the assistant' })).toHaveAttribute('href', '/assistant/pathum-rai');
	await page.locator('a.plate[aria-current="true"]').focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/assistant\/pathum-rai$/);
});

test('a shared link opens an assistant card; nothing downloads from the home page', async ({ page }) => {
	const offsite: string[] = [];
	page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4173')) offsite.push(r.url()); });
	await page.goto('/?entry=raffel-luo');
	await expect(page.locator('[data-bench-title]')).toHaveText('University of Raffel Luo assistant');
	await page.waitForLoadState('networkidle');
	expect(offsite).toEqual([]);
});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });
	test('an assistant opens in the sheet', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.locator('a.plate', { hasText: 'Pathum Rai District assistant' }).click();
		await expect(page.getByRole('link', { name: 'Open the assistant' })).toBeVisible();
	});
});
