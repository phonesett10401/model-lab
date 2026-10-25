import type { Page } from '@playwright/test';
import type { TranslateReply } from '../src/lib/comic/types';

/** A 600×800 white page with one black-outlined bubble at (100,100,300,150) holding "HELLO THERE". */
export async function comicPng(page: Page): Promise<Buffer> {
	const url = await page.evaluate(() => {
		const c = document.createElement('canvas');
		c.width = 600; c.height = 800;
		const g = c.getContext('2d')!;
		g.fillStyle = '#9ab'; g.fillRect(0, 0, 600, 800);
		g.fillStyle = '#fff'; g.fillRect(100, 100, 300, 150);
		g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(100, 100, 300, 150);
		g.fillStyle = '#000'; g.font = 'bold 28px sans-serif'; g.fillText('HELLO THERE', 150, 185);
		return c.toDataURL('image/png');
	});
	return Buffer.from(url.split(',')[1], 'base64');
}

/** An N-page PDF made by Chromium's print (chromium only). */
export async function comicPdf(page: Page, pages: number): Promise<Buffer> {
	const p = await page.context().newPage();
	const divs = Array.from({ length: pages }, (_, i) => `<div style="page-break-after:always;font:40px sans-serif">PAGE ${i + 1}</div>`).join('');
	await p.setContent(`<body style="margin:0">${divs}</body>`);
	const pdf = await p.pdf({ width: '600px', height: '800px', printBackground: true });
	await p.close();
	return pdf;
}

/** Replaces our function: POST answers with `reply` (or a 429 quota), GET reports the free tier. Records POST bodies. */
export async function fakeTranslate(page: Page, reply: TranslateReply | 'quota'): Promise<string[]> {
	const bodies: string[] = [];
	await page.route('**/api/translate', async (route) => {
		const req = route.request();
		if (req.method() === 'GET') return route.fulfill({ json: { model: 'gemini-3.5-flash', tier: 'free' } });
		bodies.push(req.postData() ?? '');
		if (reply === 'quota') return route.fulfill({ status: 429, json: { ok: false, error: 'quota' } });
		return route.fulfill({ json: reply });
	});
	return bodies;
}

/** Drags a box on the original page; corners are fractions of the page. */
export async function drawBox(page: Page, x1: number, y1: number, x2: number, y2: number) {
	const r = (await page.getByTestId('draw-layer').boundingBox())!;
	await page.mouse.move(r.x + r.width * x1, r.y + r.height * y1);
	await page.mouse.down();
	await page.mouse.move(r.x + r.width * x2, r.y + r.height * y2, { steps: 4 });
	await page.mouse.up();
}

/** Opens files; by default with the automatic find-and-translate switched off, so tests can draw boxes by hand. */
export async function openFiles(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[], auto = false) {
	await page.getByLabel('Find and translate automatically').setChecked(auto);
	await page.getByLabel('Select pictures or files to translate').setInputFiles(files);
}

export async function openFile(page: Page, name: string, mimeType: string, buffer: Buffer, auto = false) {
	await openFiles(page, [{ name, mimeType, buffer }], auto);
}
