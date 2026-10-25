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
