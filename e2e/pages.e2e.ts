import { expect, test } from '@playwright/test';

test('a planned model page is honest about having no numbers', async ({ page }) => {
	await page.goto('/models/creature-categorizer');
	await expect(page.getByRole('heading', { level: 1, name: 'Creature categorizer' })).toBeVisible();
	await expect(page.getByText('PLANNED', { exact: true })).toBeVisible();
	await expect(page.getByText('not yet measured').first()).toBeVisible();
	await expect(page.locator('main')).not.toContainText('%');
	await expect(page).toHaveTitle('Creature categorizer · AI Model Lab');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/creature-categorizer\.png$/);
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
