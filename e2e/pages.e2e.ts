import { expect, test } from '@playwright/test';

test('a planned model page is honest about having no numbers', async ({ page }) => {
	await page.goto('/models/fresh-or-spoiled');
	await expect(page.getByRole('heading', { level: 1, name: 'Fresh or spoiled' })).toBeVisible();
	await expect(page.getByText('PLANNED', { exact: true })).toBeVisible();
	await expect(page.getByText('not yet measured').first()).toBeVisible();
	await expect(page.locator('main')).not.toContainText('%');
	await expect(page).toHaveTitle('Fresh or spoiled · AI Model Lab');
});

test('the live detector page shows its measured report card', async ({ page }) => {
	await page.goto('/models/sea-creature-detector');
	await expect(page.getByRole('heading', { level: 1, name: 'Sea creature detector' })).toBeVisible();
	await expect(page.getByText('LIVE', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('DETECTION SCORE PER CREATURE (MAP@50)')).toBeVisible();
	await expect(page.getByRole('listitem', { name: /^seal, \d+ percent$/ })).toBeVisible();
	await expect(page).toHaveTitle('Sea creature detector · AI Model Lab');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/sea-creature-detector\.png$/);
});

test('the sound detective page shows its measured report card', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await expect(page.getByRole('heading', { level: 1, name: 'Sound detective' })).toBeVisible();
	await expect(page.getByText('LIVE', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('SCORE PER SOUND (AVERAGE PRECISION)')).toBeVisible();
	await expect(page.getByRole('listitem', { name: /^speech, \d+ percent$/ })).toBeVisible();
	await expect(page).toHaveTitle('Sound detective · AI Model Lab');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/sound-detective\.png$/);
});

test('a draft model shows measured metrics, worst first, with DRAFT stamp', async ({ page }) => {
	await page.goto('/models/draft-shape-sorter');
	await expect(page.getByText('DRAFT', { exact: true }).first()).toBeVisible();
	const rows = page.locator('[id$="-metrics"] li');
	await expect(rows.first()).toHaveAttribute('aria-label', 'triangle, 81 percent');
	await expect(page.getByText('said: triangle')).toBeVisible();
});

test('an audit page shows its report with before/after', async ({ page }) => {
	await page.goto('/audits/draft-document-assistant-audit');
	await expect(page.getByRole('heading', { level: 1, name: 'Document assistant audit' })).toBeVisible();
	await expect(page.locator('[id$="-metrics"] li').first()).toHaveAttribute('aria-label', 'direct jailbreak, 20 percent, 60 percent before defences');
});

test('unknown entries are 404s', async ({ page }) => {
	const res = await page.goto('/models/nope');
	expect(res?.status()).toBe(404);
});
