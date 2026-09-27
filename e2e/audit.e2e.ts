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
