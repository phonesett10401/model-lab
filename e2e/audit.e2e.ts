import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('step through attack transcripts', async ({ page }) => {
	await page.goto('/audits/draft-document-assistant-audit');
	const viewer = page.getByRole('region', { name: 'Attack transcripts' });
	await expect(viewer).toContainText('Attack 1 of 2 · Indirect prompt injection');
	await expect(viewer.locator('mark')).toContainText('Ignore previous instructions');
	await expect(viewer).toContainText('retrieved: supplier-contract.pdf · p.3');
	await expect(viewer.getByText('DEFENDED')).toBeVisible();
	await expect(viewer.getByRole('button', { name: 'Previous attack' })).toBeDisabled();

	await viewer.getByRole('button', { name: 'Next attack' }).click();
	await expect(viewer).toContainText('Attack 2 of 2 · Direct jailbreak');
	await expect(viewer.getByText('BROKEN')).toBeVisible();
	await expect(viewer.getByRole('button', { name: 'Next attack' })).toBeDisabled();
});

test('the home bench shows the viewer for audits', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/?entry=draft-document-assistant-audit');
	await expect(page.getByRole('region', { name: 'Attack transcripts' })).toBeVisible();
});

test('a published audit with transcripts does not claim its failures are unmeasured', async ({ page }) => {
	await page.goto('/audits/draft-document-assistant-audit');
	await expect(page.getByRole('heading', { name: 'HOW IT FAILS' })).toBeHidden();
});

test('an assistant audit shows the same attack under v0, D3 and v1, with the verdicts from the results', async ({ page }) => {
	const audit = JSON.parse(readFileSync('src/lib/data/audits/pathum-rai.json', 'utf8'));
	await page.goto('/audits/pathum-rai');
	const section = page.getByRole('region', { name: 'Same attack, three versions' });
	const cards = section.locator('[data-comparison]');
	await expect(cards).toHaveCount(audit.comparisons.length);
	for (const [i, c] of audit.comparisons.entries()) {
		const card = cards.nth(i);
		await expect(card.locator('[data-version]')).toHaveText(c.cells.map((x: { version: string }) => new RegExp(`^${x.version}`)));
		expect(await card.locator('[data-verdict]').evaluateAll((els) => els.map((e) => e.getAttribute('data-verdict')))).toEqual(c.cells.map((x: { verdict: string }) => x.verdict));
		await expect(card.locator('mark').first()).toBeVisible(); // the goal question is highlighted
	}
});
