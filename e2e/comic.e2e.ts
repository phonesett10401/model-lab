import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { comicPdf, comicPng, drawBox, fakeTranslate, openFile } from './comic-fake';

// Tall enough that the whole test page is on screen for mouse drags.
test.use({ viewport: { width: 1280, height: 1600 } });

const rows = (page: import('@playwright/test').Page) => page.locator('.regions > li');

/** Opens the test page and draws the bubble box (and optionally a second box lower down). */
async function setUp(page: import('@playwright/test').Page, two = false) {
	await openFile(page, 'page.png', 'image/png', await comicPng(page));
	await drawBox(page, 0.17, 0.13, 0.66, 0.31);
	if (two) await drawBox(page, 0.17, 0.6, 0.6, 0.7);
	await rows(page).nth(0).getByLabel('English').fill('HELLO THERE');
	await rows(page).nth(0).getByLabel('Speaker').selectOption('man');
	if (two) await rows(page).nth(1).getByLabel('English').fill('GO HOME');
}

test.beforeEach(async ({ page }) => {
	await fakeTranslate(page, { ok: true, lines: [], model: 'gemini-3.5-flash' });
	await page.goto('/comic-translator');
});

test('opens an image', async ({ page }) => {
	await openFile(page, 'page.png', 'image/png', await comicPng(page));
	await expect(page.getByRole('img', { name: 'Original page' })).toBeVisible();
	await expect(page.getByText('Page 1 of 1')).toBeVisible();
});

test('opens a PDF', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'PDFs are made with Chromium print');
	await openFile(page, 'book.pdf', 'application/pdf', await comicPdf(page, 3));
	await expect(page.getByText('Page 1 of 3')).toBeVisible();
	await page.getByRole('button', { name: 'Next page' }).click();
	await expect(page.getByText('Page 2 of 3')).toBeVisible();
});

test('refuses over 50 pages', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'PDFs are made with Chromium print');
	await openFile(page, 'big.pdf', 'application/pdf', await comicPdf(page, 51));
	await expect(page.getByRole('alert')).toHaveText('That PDF has more than 50 pages. Split it and open one part at a time.');
});

test('loads no PDF code for images', async ({ page }) => {
	const urls: string[] = [];
	page.on('request', (r) => urls.push(r.url()));
	await openFile(page, 'page.png', 'image/png', await comicPng(page));
	await expect(page.getByText('Page 1 of 1')).toBeVisible();
	expect(urls.filter((u) => /pdf\.worker|pdfjs|pdf\.m?js/.test(u))).toEqual([]);
});

test('rejects other files', async ({ page }) => {
	await openFile(page, 'not-an-image.png', 'image/png', readFileSync('e2e/fixtures/not-an-image.png'));
	await expect(page.getByRole('alert')).toHaveText('That file isn’t a photo this browser can read. Try a JPG, PNG or WebP.');
});

test('draws, numbers and lists boxes', async ({ page }) => {
	await openFile(page, 'page.png', 'image/png', await comicPng(page));
	await drawBox(page, 0.17, 0.6, 0.6, 0.7);
	await drawBox(page, 0.17, 0.13, 0.66, 0.31);
	await expect(rows(page)).toHaveCount(2);
	await expect(rows(page).nth(0).locator('.num')).toHaveText('1');
	await expect(rows(page).nth(1).locator('.num')).toHaveText('2');
	await expect(rows(page).nth(0).getByLabel('Kind')).toHaveValue('bubble');
	await expect(rows(page).nth(0).getByLabel('Speaker')).toHaveValue('unknown');
	await expect(rows(page).nth(0).getByLabel('English')).toBeVisible();
	await rows(page).nth(1).getByRole('button', { name: 'Delete box 2' }).click();
	await expect(rows(page)).toHaveCount(1);
});

test('shows exactly what is sent', async ({ page }) => {
	await setUp(page);
	await expect(page.getByRole('region', { name: 'Sent to Gemini (text only)' })).toContainText('1 [man] HELLO THERE');
});

test('sends text only', async ({ page }) => {
	const bodies = await fakeTranslate(page, { ok: true, lines: [{ n: 1, text: 'မင်္ဂလာပါ ခင်ဗျာ' }], model: 'gemini-3.5-flash' });
	const posts: string[] = [];
	page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.postData() ?? ''); });
	await setUp(page);
	await page.getByRole('button', { name: 'Translate page' }).click();
	await expect(rows(page).nth(0).getByLabel('Burmese')).toHaveValue('မင်္ဂလာပါ ခင်ဗျာ');
	expect(bodies).toEqual(['{"lines":[{"n":1,"text":"HELLO THERE","cls":"bubble","speaker":"man"}]}']);
	for (const p of posts) {
		expect(p).not.toContain('data:image');
		expect(p.length).toBeLessThan(20_000);
	}
});

test('fills Burmese and flags problems', async ({ page }) => {
	await fakeTranslate(page, { ok: true, lines: [{ n: 1, text: 'မင်္ဂလာပါ ခင်ဗျာ' }], model: 'gemini-3.5-flash' });
	await setUp(page, true);
	await page.getByRole('button', { name: 'Translate page' }).click();
	await expect(rows(page).nth(0).getByLabel('Burmese')).toHaveValue('မင်္ဂလာပါ ခင်ဗျာ');
	await expect(rows(page).nth(1).locator('.problem')).toHaveText('Didn’t come back. Retry or type your own.');
	await fakeTranslate(page, { ok: true, lines: [{ n: 1, text: 'ဟယ်လို' }, { n: 2, text: 'အိမ်ပြန်' }], model: 'gemini-3.5-flash' });
	await page.getByRole('button', { name: 'Retry flagged lines' }).click();
	await expect(rows(page).nth(1).getByLabel('Burmese')).toHaveValue('အိမ်ပြန်');
	await expect(rows(page).nth(1).locator('.problem')).toHaveCount(0);
	await expect(rows(page).nth(0).getByLabel('Burmese')).toHaveValue('မင်္ဂလာပါ ခင်ဗျာ');
});

test('quota keeps work', async ({ page }) => {
	await fakeTranslate(page, 'quota');
	await setUp(page);
	await page.getByRole('button', { name: 'Translate page' }).click();
	await expect(page.getByRole('alert')).toHaveText('Today’s translations are used up. Try again tomorrow.');
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page).nth(0).getByLabel('English')).toHaveValue('HELLO THERE');
});

test('states the tier', async ({ page }) => {
	await expect(page.getByText('Translating with gemini-3.5-flash on the free tier: only use public-domain or openly licensed pages.')).toBeVisible();
});

test('nothing leaves on load', async ({ page, baseURL }) => {
	const bad: string[] = [];
	page.on('request', (r) => { if (!r.url().startsWith(baseURL!) || r.method() === 'POST') bad.push(`${r.method()} ${r.url()}`); });
	await page.reload();
	await openFile(page, 'page.png', 'image/png', await comicPng(page));
	await expect(page.getByText('Page 1 of 1')).toBeVisible();
	await page.waitForLoadState('networkidle');
	expect(bad).toEqual([]);
});
