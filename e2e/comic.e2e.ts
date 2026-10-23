import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { comicPdf, comicPng, fakeTranslate, openFile } from './comic-fake';

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
