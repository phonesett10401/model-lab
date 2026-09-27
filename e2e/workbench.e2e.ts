import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });
const demo = (page: import('@playwright/test').Page) => page.locator('.demo');

test('a planned model is clearly not live', async ({ page }) => {
	await page.goto('/?entry=creature-categorizer');
	await expect(demo(page)).toHaveAttribute('data-state', 'not-live');
	await expect(page.getByRole('button', { name: 'Upload' })).toBeDisabled();
	await expect(page.getByText(/no made-up results/)).toBeVisible();
});

test('a sample runs through loading → examining → result', async ({ page }) => {
	await page.goto('/?entry=draft-shape-sorter');
	await page.getByRole('button', { name: 'Circle' }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'examining');
	await expect(demo(page)).toHaveAttribute('data-state', 'result');
	await expect(page.locator('.answer')).toHaveText('circle');
	await expect(page.getByRole('listitem', { name: 'circle, 93 percent' })).toBeVisible();
});

test('a low-confidence answer says it is unsure', async ({ page }) => {
	await page.goto('/?entry=draft-shape-sorter');
	await page.getByRole('button', { name: /Star/ }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'unsure');
	await expect(page.locator('.answer')).toHaveText('Not sure');
	await expect(page.getByText(/Not confident/)).toBeVisible();
});

test('an unreadable file shows an error and keeps the previous result', async ({ page }) => {
	await page.goto('/?entry=draft-shape-sorter');
	await page.getByRole('button', { name: 'Circle' }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'result');
	await page.locator('input[type=file]:not([capture])').setInputFiles('e2e/fixtures/not-an-image.png');
	await expect(page.getByRole('alert')).toContainText('isn’t a photo this browser can read');
	await expect(page.getByText('Previous result:')).toBeVisible();
	await expect(page.getByRole('listitem', { name: 'circle, 93 percent' })).toBeVisible();
});

test('only the latest request wins', async ({ page }) => {
	await page.goto('/?entry=draft-shape-sorter');
	await expect(page.getByRole('button', { name: 'Circle' })).toBeEnabled();
	await page.evaluate(() => {
		const [circle, square] = [...document.querySelectorAll<HTMLButtonElement>('.samples button')];
		circle.click();
		square.click(); // same tick, before the first has disabled the buttons
	});
	await expect(demo(page)).toHaveAttribute('data-state', 'result');
	await expect(page.locator('.answer')).toHaveText('square');
});

test('"Try this one" loads a failure into the demo', async ({ page }) => {
	await page.goto('/?entry=draft-shape-sorter');
	await page.getByRole('tab', { name: 'Fails' }).click(); // bench is ~900px here: report is tabbed
	await page.getByRole('button', { name: 'Try this one' }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'unsure');
});
