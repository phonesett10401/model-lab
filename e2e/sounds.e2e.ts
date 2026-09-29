import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Parity: the page must reproduce the outputs recorded from the exported model by sounds_pick_examples.py.
const sounds = JSON.parse(readFileSync('src/lib/data/sound-detective.json', 'utf8')) as {
	classes: string[];
	samples: { id: string; title: string; credit: string; expected: { label: string; score: number; start: number; end: number }[] }[];
};

test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(90_000);
// Playwright's Windows WebKit build has no Web Audio (real Safari does), so clips can't be decoded there.
const noWebAudio = (browserName: string) => test.skip(browserName === 'webkit', 'Windows WebKit has no Web Audio');
test.beforeEach(({ browserName }) => noWebAudio(browserName));

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
const heard = (page: Page) => page.locator('.events li[data-label]').evaluateAll((els) => els.map((e) => ({
	label: e.getAttribute('data-label')!, start: Number(e.getAttribute('data-start')), end: Number(e.getAttribute('data-end')), score: Number(e.getAttribute('data-score'))
})));
const upload = (page: Page, file: string) => page.locator('input[type=file][accept^="audio"]').setInputFiles(file);

test('every sample gives the sounds, times and scores the model was measured with', async ({ page }) => {
	await page.goto('/models/sound-detective');
	for (const s of sounds.samples) {
		await runs(page, () => page.getByRole('button', { name: s.title, exact: true }).click());
		const got = await heard(page);
		expect(got.map((g) => g.label), s.id).toEqual(s.expected.map((e) => e.label));
		s.expected.forEach((e, i) => {
			expect(Math.abs(got[i].start - e.start), `${s.id} ${e.label} start`).toBeLessThanOrEqual(0.25);
			expect(Math.abs(got[i].end - e.end), `${s.id} ${e.label} end`).toBeLessThanOrEqual(0.25);
			expect(Math.abs(got[i].score - e.score), `${s.id} ${e.label} score`).toBeLessThan(0.03);
		});
		await expect(page.getByText(s.credit)).toBeVisible();
	}
});

test('overlapping sounds sit on separate lanes', async ({ page }) => {
	const s = sounds.samples.find((x) => x.id === 'overlap');
	test.skip(!s, 'no overlap sample was found in the test clips');
	await page.goto('/models/sound-detective');
	await runs(page, () => page.getByRole('button', { name: s!.title, exact: true }).click(), 'result');
	const labels = [...new Set(s!.expected.map((e) => e.label))];
	for (const l of labels) await expect(page.locator(`.timeline [data-lane="${l}"]`)).toHaveCount(1);
});

test('a silent clip says it heard nothing it knows', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled();
	await runs(page, () => upload(page, 'e2e/fixtures/sounds-silence.wav'), 'unsure');
	await expect(page.locator('.answer')).toHaveText('No sounds it knows');
});

test('a clip that is too short says so', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled();
	await upload(page, 'e2e/fixtures/sounds-short.wav');
	await expect(page.getByRole('alert')).toHaveText('Too short to hear anything. Record a little longer.', { timeout: 60_000 });
});

test('a long upload is cut to 30 seconds, with a note', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled();
	await runs(page, () => upload(page, 'e2e/fixtures/sounds-long.wav'));
	await expect(page.getByText('Only the first 30 seconds were checked.')).toBeVisible();
	for (const g of await heard(page)) expect(g.end).toBeLessThanOrEqual(30);
});

for (const [file, what] of [['sounds-stereo-44k.wav', 'stereo 44.1 kHz WAV'], ['sounds-stereo-44k.mp3', 'stereo MP3'], ['sounds-recording.webm', 'a phone-style WebM recording']] as const)
	test(`${what} finds the same sounds as the original sample`, async ({ page }) => {
		const first = sounds.samples[0];
		await page.goto('/models/sound-detective');
		await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled();
		// A recording arrives as audio/webm (Playwright would label a .webm file video/webm).
		const types: Record<string, string> = { webm: 'audio/webm', mp3: 'audio/mpeg', wav: 'audio/wav' };
		const ext = file.split('.').pop()!;
		await runs(page, () => page.locator('input[type=file][accept^="audio"]').setInputFiles({ name: file, mimeType: types[ext], buffer: readFileSync(`e2e/fixtures/${file}`) }));
		expect([...new Set((await heard(page)).map((g) => g.label))].sort()).toEqual([...new Set(first.expected.map((e) => e.label))].sort());
	});

test('a failed model download shows an error, and the next try works', async ({ page }) => {
	let first = true;
	await page.route('**/models/sound-detective-v1.onnx', (route) => (first ? ((first = false), route.abort()) : route.continue()));
	await page.goto('/models/sound-detective');
	const s = sounds.samples[0];
	await page.getByRole('button', { name: s.title, exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('failed to run');
	await page.getByRole('button', { name: s.title, exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', /result|unsure/, { timeout: 60_000 });
});

test('the home page never downloads the sound model', async ({ page }) => {
	const heavy: string[] = [];
	page.on('request', (r) => { if (/sound-detective-v1\.onnx$|worklets\/capture/.test(r.url())) heavy.push(r.url()); });
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	expect(heavy).toEqual([]);
});

