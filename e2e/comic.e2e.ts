import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
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

/** Pixel facts computed inside the page (shipping ~2M values to the test is too slow). */
const canvasHash = (page: import('@playwright/test').Page) =>
	page.locator('[aria-label="Burmese page"] canvas').evaluate((c: HTMLCanvasElement) => {
		const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
		let h = 0;
		for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) | 0;
		return h;
	});

async function translated(page: import('@playwright/test').Page) {
	await fakeTranslate(page, { ok: true, lines: [{ n: 1, text: 'မင်္ဂလာပါ ခင်ဗျာ' }], model: 'gemini-3.5-flash' });
	await setUp(page);
	await page.getByRole('button', { name: 'Translate page' }).click();
	await expect(page.locator('.stage[aria-label="Burmese page"]')).toHaveAttribute('data-rendered', 'true');
}

test('letters the Burmese in place', async ({ page }) => {
	await translated(page);
	const { inside, outside } = await page.evaluate(() => {
		const get = (label: string) => {
			const c = document.querySelector<HTMLCanvasElement>(`[aria-label="${label}"] canvas`)!;
			return c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
		};
		const before = get('Original page'), after = get('Burmese page');
		let inside = 0, outside = 0;
		for (let i = 0; i < before.length; i += 4) {
			const x = (i / 4) % 600, y = Math.floor(i / 4 / 600);
			const same = before[i] === after[i] && before[i + 1] === after[i + 1] && before[i + 2] === after[i + 2];
			// The drawn box is about (102,104)-(396,248); allow a margin for a grown box.
			const near = x > 60 && x < 440 && y > 60 && y < 290;
			if (!near && !same) outside++;
			if (x > 140 && x < 360 && y > 150 && y < 200 && !same) inside++;
		}
		return { inside, outside };
	});
	expect(outside).toBe(0);
	expect(inside).toBeGreaterThan(100);
});

test('uses the Myanmar font', async ({ page }) => {
	await translated(page);
	expect(await page.evaluate(() => document.fonts.check('16px "Noto Sans Myanmar"', 'မ'))).toBe(true);
});

test('downloads a PNG', async ({ page }) => {
	await translated(page);
	const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PNG' }).click()]);
	expect(download.suggestedFilename()).toBe('comic-page-1-my.png');
	const png = readFileSync(await download.path());
	expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([600, 800]);
});

test('edits redraw', async ({ page }) => {
	await translated(page);
	const first = await canvasHash(page);
	await rows(page).nth(0).getByLabel('Burmese').fill('အိမ်ပြန်ကြစို့');
	await expect.poll(() => canvasHash(page)).not.toBe(first);
});

for (const scheme of ['light', 'dark'] as const)
	test(`has no axe violations (${scheme})`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
		await translated(page);
		const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
		expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
	});

test('fits a phone', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await translated(page);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('releases old pages and PDF workers', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'PDFs are made with Chromium print');
	await page.addInitScript(() => {
		const close = ImageBitmap.prototype.close;
		(window as any).__closed = 0;
		ImageBitmap.prototype.close = function () { (window as any).__closed++; return close.call(this); };
	});
	await page.reload();
	const workers: import('@playwright/test').Worker[] = [];
	page.on('worker', (w) => workers.push(w));
	await openFile(page, 'a.pdf', 'application/pdf', await comicPdf(page, 3));
	await page.getByRole('button', { name: 'Next page' }).click();
	await expect(page.getByText('Page 2 of 3')).toBeVisible();
	await page.getByRole('button', { name: 'Next page' }).click();
	await expect(page.getByText('Page 3 of 3')).toBeVisible();
	await expect.poll(() => page.evaluate(() => (window as any).__closed)).toBeGreaterThanOrEqual(2);
	const first = workers[0];
	const closed = new Promise((r) => first.once('close', r));
	await openFile(page, 'b.pdf', 'application/pdf', await comicPdf(page, 2));
	await expect(page.getByText('Page 1 of 2')).toBeVisible();
	await closed;
});

test('a failed load says so', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'PDFs are made with Chromium print');
	// Like a stale deploy: any script fetched after the page loaded fails, so pdf.js can't load.
	await page.waitForLoadState('networkidle');
	await page.route(/\/_app\/.*\.m?js$/, (r) => r.abort());
	await openFile(page, 'a.pdf', 'application/pdf', await comicPdf(page, 2));
	await expect(page.getByRole('alert')).toHaveText('That file couldn’t be opened. Try again.');
});

test('busy says a minute', async ({ page }) => {
	await fakeTranslate(page, { ok: false, error: 'busy' });
	await setUp(page);
	await page.getByRole('button', { name: 'Translate page' }).click();
	await expect(page.getByRole('alert')).toHaveText('Busy right now. Try again in a minute.');
});

test('original and Burmese pages line up', async ({ page }) => {
	await openFile(page, 'page.png', 'image/png', await comicPng(page));
	const a = (await page.locator('[aria-label="Original page"] canvas').boundingBox())!;
	const b = (await page.locator('[aria-label="Burmese page"] canvas').boundingBox())!;
	expect(Math.abs(a.y - b.y)).toBeLessThan(2);
	const stage = (await page.locator('.stage[aria-label="Original page"]').boundingBox())!;
	expect(stage.height - a.height).toBeLessThan(4); // no empty strip under the page
});

// ---------- Plan 3: find the text automatically (real detector and OCR, on the device) ----------

const pepper = () => readFileSync('e2e/fixtures/comic-pepper.jpg');

test('nothing downloads before asking', async ({ page }) => {
	const urls: string[] = [];
	page.on('request', (r) => urls.push(r.url()));
	await openFile(page, 'p.jpg', 'image/jpeg', pepper());
	await expect(page.getByText('Page 1 of 1')).toBeVisible();
	await page.waitForLoadState('networkidle');
	expect(urls.filter((u) => /comic-text-detector|\/ocr\/|traineddata/.test(u))).toEqual([]);
});

test('finds the text', async ({ page, baseURL }) => {
	test.setTimeout(180_000);
	const offsite: string[] = [];
	page.on('request', (r) => { if (!r.url().startsWith(baseURL!)) offsite.push(r.url()); });
	await openFile(page, 'p.jpg', 'image/jpeg', pepper());
	await page.getByRole('button', { name: 'Find the text for me' }).click();
	await expect(page.locator('.comic')).toHaveAttribute('data-auto', 'done', { timeout: 150_000 });
	// Every box either holds the English the reader found, or asks the visitor to type it.
	const found = await rows(page).evaluateAll((els) => els.map((li) => ({
		english: (li.querySelector('label.wide input') as HTMLInputElement).value, unread: li.querySelector('.problem')?.textContent ?? '' })));
	expect(found.filter((r) => r.english).length).toBeGreaterThanOrEqual(3);
	for (const r of found) expect(r.english || r.unread).toBeTruthy();
	expect(offsite).toEqual([]);
});

test('auto finds nothing', async ({ page }) => {
	test.setTimeout(180_000);
	const blank = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 1000; const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 800, 1000); return c.toDataURL('image/png'); });
	await openFile(page, 'b.png', 'image/png', Buffer.from(blank.split(',')[1], 'base64'));
	await page.getByRole('button', { name: 'Find the text for me' }).click();
	await expect(page.getByRole('status')).toHaveText('No English found. Draw boxes by hand.', { timeout: 150_000 });
	await drawBox(page, 0.2, 0.2, 0.5, 0.3);
	await expect(rows(page)).toHaveCount(1);
});

test('download fails', async ({ page }) => {
	await page.route('**/models/comic-text-detector.onnx', (r) => r.abort());
	await openFile(page, 'p.jpg', 'image/jpeg', pepper());
	await page.getByRole('button', { name: 'Find the text for me' }).click();
	await expect(page.getByRole('alert')).toHaveText('Couldn’t download the text finder. Check the connection and try again.');
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
	await drawBox(page, 0.2, 0.2, 0.5, 0.3);
	await expect(rows(page)).toHaveCount(1);
});

test('unread boxes are not sent', async ({ page }) => {
	test.setTimeout(180_000);
	const bodies = await fakeTranslate(page, { ok: true, lines: [], model: 'gemini-3.5-flash' });
	await openFile(page, 'p.jpg', 'image/jpeg', pepper());
	await page.getByRole('button', { name: 'Find the text for me' }).click();
	await expect(page.locator('.comic')).toHaveAttribute('data-auto', 'done', { timeout: 150_000 });
	const before = await rows(page).count();
	const readable = await rows(page).evaluateAll((els) => els.filter((li) => (li.querySelector('label.wide input') as HTMLInputElement).value).length);
	await drawBox(page, 0.02, 0.97, 0.06, 0.99); // a sliver of art with no words
	await expect(rows(page).nth(before).locator('.problem')).toHaveText('Couldn’t read this. Type the English.', { timeout: 60_000 });
	await page.getByRole('button', { name: 'Translate page' }).click();
	await expect.poll(() => bodies.length).toBe(1);
	expect(JSON.parse(bodies[0]).lines).toHaveLength(readable);
});

test('manga order', async ({ page }) => {
	await openFile(page, 'page.png', 'image/png', await comicPng(page));
	await drawBox(page, 0.05, 0.13, 0.3, 0.2);
	await drawBox(page, 0.6, 0.13, 0.9, 0.2);
	await page.getByLabel('Manga order (right to left)').check();
	const x = await rows(page).nth(0).getAttribute('data-x');
	expect(Number(x)).toBeGreaterThan(300);
});
