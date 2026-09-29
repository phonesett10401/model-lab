import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const first = JSON.parse(readFileSync('src/lib/data/sound-detective.json', 'utf8')).samples[0] as { title: string };

test('a browser that can’t read audio says so plainly', async ({ page, browserName }) => {
	test.skip(browserName !== 'webkit', 'only Playwright’s Windows WebKit lacks Web Audio');
	test.setTimeout(90_000);
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: first.title, exact: true }).click();
	await expect(page.getByRole('alert')).toHaveText('This browser can’t read audio. Try another browser.', { timeout: 60_000 });
});
