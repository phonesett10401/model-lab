import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// The spec's parity check, done in the real browser: the page must reproduce the outputs Ultralytics recorded.
const sea = JSON.parse(readFileSync('src/lib/data/sea-creature-detector.json', 'utf8')) as {
	samples: {
		id: string; title: string; credit: string; creditUrl: string; license: string; licenseUrl: string;
		expected: { label: string; score: number; box: number[] }[];
	}[];
};

test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(90_000); // first run downloads ~24 MB and compiles the engine

const demo = (page: Page) => page.locator('.demo');
/** Do something that starts a run, then wait for THAT run's answer (the previous result stays on screen until examining starts). */
async function runs(page: Page, act: () => Promise<void>, until: RegExp | string = /result|unsure/) {
	const started = demo(page).evaluate((d: HTMLElement) => new Promise<void>((resolve) => {
		const o = new MutationObserver(() => { if (d.dataset.state === 'examining') { o.disconnect(); resolve(); } });
		o.observe(d, { attributes: true, attributeFilter: ['data-state'] });
	}));
	await act();
	await started;
	await expect(demo(page)).toHaveAttribute('data-state', until, { timeout: 60_000 });
}
const found = (page: Page) => page.locator('.dets li[data-label]').evaluateAll((els) => els.map((e) => ({
	label: e.getAttribute('data-label')!, score: Number(e.getAttribute('data-score')), box: JSON.parse(e.getAttribute('data-box')!) as number[]
})));
const iou = (a: number[], b: number[]) => {
	const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
	return (ix * iy) / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - ix * iy);
};

test('every sample gives the same creatures, scores and boxes the model was measured with', async ({ page }) => {
	await page.goto('/models/sea-creature-detector');
	for (const s of sea.samples) {
		await runs(page, () => page.getByRole('button', { name: s.title, exact: true }).click());
		const got = await found(page);
		expect(got.length, `${s.id}: number of creatures`).toBe(Math.min(s.expected.length, 12));
		expect(got.map((g) => g.label).sort()).toEqual(s.expected.slice(0, got.length).map((e) => e.label).sort());
		// Match each recorded box to the page's closest box of the same creature: near-tied scores may list in either order.
		for (const e of s.expected.slice(0, got.length)) {
			const best = got.filter((g) => g.label === e.label).sort((a, b) => iou(b.box, e.box) - iou(a.box, e.box))[0];
			expect(iou(best.box, e.box), `${s.id}: ${e.label} box`).toBeGreaterThan(0.9);
			expect(Math.abs(best.score - e.score), `${s.id}: ${e.label} score`).toBeLessThan(0.03);
		}
		await expect(page.getByText(s.credit)).toBeVisible();
	}
});

test('boxes are drawn on the photo and the headline counts them', async ({ page }) => {
	await page.goto('/models/sea-creature-detector');
	await page.getByRole('button', { name: 'Dolphin', exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
	await expect(page.locator('.drop svg rect')).toHaveCount(sea.samples.find((s) => s.id === 'dolphin')!.expected.length);
	await expect(page.locator('.answer')).toHaveText(/^\d+ dolphins?$/);
});

test('a crowded photo lists the first 12 and says how many more', async ({ page }) => {
	const busiest = [...sea.samples].sort((a, b) => b.expected.length - a.expected.length)[0];
	test.skip(busiest.expected.length <= 12, 'no sample has more than 12 creatures');
	await page.goto('/models/sea-creature-detector');
	await page.getByRole('button', { name: busiest.title, exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
	await expect(page.locator('.dets li[data-label]')).toHaveCount(12);
	await expect(page.getByText(`+${busiest.expected.length - 12} more`)).toBeVisible();
});

test('a photo with no known creature says so and lists what it knows', async ({ page }) => {
	await page.goto('/models/sea-creature-detector');
	await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled(); // uploads open once the page knows the model is live
	await runs(page, () => page.locator('input[type=file]:not([capture])').setInputFiles('e2e/fixtures/not-a-creature.jpg'), 'unsure');
	await expect(page.locator('.answer')).toHaveText('No sea creatures found');
	await expect(page.getByText(/sea lion, seal, crab/)).toBeVisible();
});

test('an EXIF-rotated phone photo finds the same creatures as the upright one', async ({ page }) => {
	await page.goto('/models/sea-creature-detector');
	// The aquarium sample: many small, off-centre creatures, so a sideways reading can't land its boxes in the same places by chance.
	await runs(page, () => page.getByRole('button', { name: 'Aquarium tank', exact: true }).click(), 'result');
	const upright = await found(page);
	await runs(page, () => page.locator('input[type=file]:not([capture])').setInputFiles('e2e/fixtures/rotated-aquarium.jpg'), 'result');
	const rotated = await found(page);
	expect(rotated.map((g) => g.label).sort()).toEqual(upright.map((g) => g.label).sort());
	// Same photo, so every box must land in the same place on the photo as the visitor sees it.
	for (const u of upright) expect(Math.max(...rotated.filter((r) => r.label === u.label).map((r) => iou(r.box, u.box)))).toBeGreaterThan(0.8);
});

test('a failed download shows an error, and the next try works', async ({ page }) => {
	let first = true;
	await page.route('**/models/sea-creature-detector-v2.onnx', (route) => (first ? ((first = false), route.abort()) : route.continue()));
	await page.goto('/models/sea-creature-detector');
	await page.getByRole('button', { name: 'Dolphin', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('failed to run');
	await page.getByRole('button', { name: 'Dolphin', exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
});

test('a failed engine download shows an error, and the next try works', async ({ page }) => {
	let first = true;
	await page.route('**/ort-wasm-simd-threaded*.wasm', (route) => (first ? ((first = false), route.abort()) : route.continue()));
	await page.goto('/models/sea-creature-detector');
	await page.getByRole('button', { name: 'Dolphin', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('failed to run');
	await page.getByRole('button', { name: 'Dolphin', exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
});

test('the progress bar counts the engine too, not just the model', async ({ page }) => {
	let release!: () => void;
	const held = new Promise<void>((r) => (release = r));
	await page.route('**/ort-wasm-simd-threaded*.wasm', async (route) => { await held; await route.continue(); });
	await page.goto('/models/sea-creature-detector');
	await page.getByRole('button', { name: 'Dolphin', exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'loading');
	await page.waitForTimeout(1500); // the 9.8 MB model is local and arrives well within this; the engine is held
	const value = await page.locator('.out progress').evaluate((p: HTMLProgressElement) => (p.hasAttribute('value') ? p.value : null));
	release();
	expect(value).not.toBeNull();
	expect(value!).toBeLessThan(0.6); // model is ~41% of the 24 MB; a full bar here would mean the engine isn't counted
	await expect(demo(page)).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
});

test('the built site ships the engine exactly once', () => {
	const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [d.name]));
	expect(walk('build').filter((f) => /^ort-wasm-simd-threaded.*\.wasm$/.test(f))).toHaveLength(1);
});

test('each sample credits its photographer and licence with links', async ({ page }) => {
	await page.goto('/models/sea-creature-detector');
	for (const s of sea.samples) {
		await runs(page, () => page.getByRole('button', { name: s.title, exact: true }).click());
		await expect(page.getByRole('link', { name: s.credit, exact: true })).toHaveAttribute('href', s.creditUrl);
		await expect(page.getByRole('link', { name: s.license, exact: true })).toHaveAttribute('href', s.licenseUrl);
	}
});

test('the home page never downloads the model or the engine', async ({ page }) => {
	const heavy: string[] = [];
	page.on('request', (r) => { if (/\.onnx$|ort-wasm/.test(r.url())) heavy.push(r.url()); });
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	expect(heavy).toEqual([]);
});
