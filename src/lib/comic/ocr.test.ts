import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { copyOcrAssets, OCR_FILES } from './ocr-assets';
import { looksEnglish } from './ocr';

it('junk is not English', () => {
	expect(looksEnglish('~~ |', 80)).toBe(false);
	expect(looksEnglish('HELLO', 30)).toBe(false);
	expect(looksEnglish('HELLO THERE', 85)).toBe(true);
});

it('copies every OCR file to be served from our own site', () => {
	const dest = mkdtempSync(join(tmpdir(), 'ocr-'));
	copyOcrAssets(process.cwd(), dest);
	for (const [name, from] of Object.entries(OCR_FILES)) expect(statSync(join(dest, name)).size).toBe(statSync(from).size);
	expect(Object.keys(OCR_FILES)).toContain('tesseract-core-simd-lstm.wasm.js');
});

it('states the real OCR download size', async () => {
	const { OCR_MB, OCR_MODEL } = await import('./ocr');
	const files = ['worker.min.js', 'tesseract-core-simd-lstm.wasm.js', `eng/${OCR_MODEL}/eng.traineddata.gz`];
	const bytes = files.reduce((s, f) => s + statSync(OCR_FILES[f]).size, 0);
	expect(OCR_MB).toBe(Math.round(bytes / 1e5) / 10);
});

it('whitens a panel border touching the crop but keeps the letters', async () => {
	const { stripBorders } = await import('./ocr');
	const w = 60, h = 40, g = new Uint8ClampedArray(w * h).fill(255);
	for (let y = 0; y < h; y++) g[y * w + 1] = g[y * w + 2] = 0; // a border line down the left edge, full height
	for (let y = 15; y < 25; y++) for (let x = 20; x < 24; x++) g[y * w + x] = 0; // a letter stroke
	for (let y = 15; y < 25; y++) g[y * w + 3] = 0; // a letter touching the border
	stripBorders(g, w, h);
	expect(g[10 * w + 1]).toBe(255); // border gone
	expect(g[20 * w + 21]).toBe(0); // free letter kept
});
