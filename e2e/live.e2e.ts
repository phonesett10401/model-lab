import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const sounds = JSON.parse(readFileSync('src/lib/data/sound-detective.json', 'utf8')) as { samples: { id: string; expected: { label: string }[] }[] };
const clip = sounds.samples[0];
test.use({
	viewport: { width: 1280, height: 900 },
	permissions: ['microphone'],
	launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${resolve(`static/samples/sounds/${clip.id}.wav`)}`] }
});
test.setTimeout(90_000);

const liveTracks = (page: Page) => page.evaluate(() =>
	(window as unknown as { streams: MediaStream[] }).streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length);

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		const w = window as unknown as { streams: MediaStream[] };
		w.streams = [];
		const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
		navigator.mediaDevices.getUserMedia = async (c) => { const s = await orig(c); w.streams.push(s); return s; };
	});
});

test('live listening waits for the download, then marks the sound as it plays', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', /loading|listening/);
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'listening', { timeout: 60_000 });
	await expect(page.getByRole('status')).toContainText('Listening');
	await expect(page.locator(`.timeline [data-lane="${clip.expected[0].label}"]`)).toHaveCount(1, { timeout: 20_000 });
	await page.getByRole('button', { name: '■ Stop listening' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', /result|unsure/, { timeout: 30_000 });
	expect(await liveTracks(page)).toBe(0);
});

test('live listening stops by itself after 2 minutes', async ({ page }) => {
	await page.clock.install();
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'listening', { timeout: 60_000 });
	// Let it hear something first: stopping after under half a second rightly says "Too short".
	await expect(page.locator(`.timeline [data-lane="${clip.expected[0].label}"]`)).toHaveCount(1, { timeout: 20_000 });
	await page.clock.fastForward(120_000);
	await expect(page.locator('.demo')).toHaveAttribute('data-state', /result|unsure|examining/, { timeout: 30_000 });
	expect(await liveTracks(page)).toBe(0);
});

test('hiding the tab stops listening', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'listening', { timeout: 60_000 });
	await page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(page.locator('.demo')).not.toHaveAttribute('data-state', 'listening');
	expect(await liveTracks(page)).toBe(0);
});

test('leaving the page turns the microphone off', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'listening', { timeout: 60_000 });
	await page.getByRole('link', { name: 'AI MODEL LAB' }).click(); // client-side navigation: same window, component destroyed
	await page.waitForTimeout(500);
	expect(await liveTracks(page)).toBe(0);
});

test('a blocked microphone says so', async ({ page }) => {
	await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError')); });
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.getByRole('alert')).toContainText('Microphone access was blocked', { timeout: 60_000 });
});

test('leaving while the microphone prompt is still open never leaves it on', async ({ page }) => {
	await page.addInitScript(() => {
		const slow = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
		navigator.mediaDevices.getUserMedia = async (c) => { await new Promise((r) => setTimeout(r, 1500)); return slow(c); };
	});
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', /loading|ready/);
	await page.waitForFunction(() => document.querySelector('.demo')?.getAttribute('data-state') !== 'loading', null, { timeout: 60_000 });
	await page.getByRole('link', { name: 'AI MODEL LAB' }).click(); // leave before the (slow) prompt resolves
	await page.waitForTimeout(2500);
	expect(await liveTracks(page)).toBe(0);
});

test('leaving during the model download never asks for the microphone', async ({ page }) => {
	await page.addInitScript(() => {
		const w = window as unknown as { gum: number };
		w.gum = 0;
		const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
		navigator.mediaDevices.getUserMedia = (c) => { w.gum++; return orig(c); };
	});
	let release!: () => void;
	const held = new Promise<void>((r) => (release = r));
	await page.route('**/models/sound-detective-v1.onnx', async (route) => { await held; await route.continue(); });
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'loading');
	await page.getByRole('link', { name: 'AI MODEL LAB' }).click(); // leave mid-download
	release();
	await page.waitForTimeout(3000); // the download finishes after the page is gone
	expect(await page.evaluate(() => (window as unknown as { gum: number }).gum)).toBe(0);
});

test('while listening, the page is honest about what it keeps and doesn’t chatter to screen readers', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'listening', { timeout: 60_000 });
	await expect(page.getByText('Only the last 30 seconds are kept, on your device. Nothing is uploaded.')).toBeVisible();
	await expect(page.locator('.out .answer')).toHaveAttribute('aria-live', 'off'); // changes every half second
	await page.getByRole('button', { name: '■ Stop listening' }).click();
});

test('an audio context that starts suspended (as Safari may) still hears', async ({ page }) => {
	await page.addInitScript(() => {
		const Orig = window.AudioContext;
		window.AudioContext = class extends Orig {
			constructor(o?: AudioContextOptions) { super(o); void this.suspend(); }
		} as typeof AudioContext;
	});
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'listening', { timeout: 60_000 });
	await expect(page.locator(`.timeline [data-lane="${clip.expected[0].label}"]`)).toHaveCount(1, { timeout: 20_000 });
	await page.getByRole('button', { name: '■ Stop listening' }).click();
});
