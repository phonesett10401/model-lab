import { whitenOutside } from './bubble';
import type { Box } from './types';

/** Which English model: picked by measurement in plan 3 task 3 (see training/comic_vendor.md). */
export const OCR_MODEL = 'best_int' as 'best_int' | 'standard';
export const OCR_MB = 7; // worker + one engine variant + English data, as downloaded by the browser (checked by a test)

/** At least two letters and a confident reading: otherwise the visitor types the English. */
export function looksEnglish(text: string, conf: number): boolean {
	return (text.match(/[A-Za-z]/g) ?? []).length >= 2 && conf >= 40;
}

type Worker = import('tesseract.js').Worker;
type Model = typeof OCR_MODEL;
const workers = new Map<Model, Promise<Worker>>();

/** One Tesseract worker per model, kept while the translator is open (stopOcr ends it), loaded from /ocr/ on our own
 * site (copied there by vite.config.ts). */
function getWorker(model: Model = OCR_MODEL): Promise<Worker> {
	const known = workers.get(model);
	if (known) return known;
	const worker = (async () => {
		const { createWorker, PSM } = await import('tesseract.js');
		const w = await createWorker('eng', 1, {
			workerPath: '/ocr/worker.min.js',
			corePath: '/ocr/',
			langPath: `/ocr/eng/${model}/`,
			cachePath: `ocr-eng-${model}`, // the browser caches the data by this key: one key per model
			gzip: true,
			workerBlobURL: false
		});
		await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
		return w;
	})();
	workers.set(model, worker);
	worker.catch(() => workers.delete(model)); // a failed download can be retried
	return worker;
}

export const loadOcr = () => getWorker().then(() => undefined);

/** Ends the workers when the visitor leaves the translator, so a phone gets their memory back. */
export function stopOcr() {
	for (const w of workers.values()) w.then((x) => x.terminate()).catch(() => {});
	workers.clear();
}

/** Below this confidence a second, cleaned-up reading is tried and the more confident one kept. */
const SURE = 60;

/**
 * Whitens ink blobs (grey < 128, one byte per pixel) that are panel borders or bubble outlines rather than letters:
 * big ones touching the crop's edge, and any taller than half the crop. Bold hand lettering that touches a border
 * otherwise reads as junk ("YOU'RE WRONG!" came back as "| YOLIRE =").
 */
export function stripBorders(g: Uint8ClampedArray, w: number, h: number): void {
	const label = new Int32Array(w * h).fill(-1);
	for (let start = 0; start < w * h; start++) {
		if (g[start] >= 128 || label[start] >= 0) continue;
		const blob = [start];
		label[start] = start;
		let x0 = w, y0 = h, x1 = 0, y1 = 0;
		for (let k = 0; k < blob.length; k++) {
			const i = blob[k], x = i % w, y = (i / w) | 0;
			if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
			for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
				if (j >= 0 && j < w * h && label[j] < 0 && g[j] < 128) { label[j] = start; blob.push(j); }
		}
		const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
		const edge = x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1;
		if ((edge && (bh > 0.4 * h || bw > 0.4 * w)) || bh > 0.5 * h) for (const i of blob) g[i] = 255;
	}
}

/** One crop of the box in grey, `scale`× larger; optionally with borders whitened and a white margin around it. */
function crop(bmp: ImageBitmap, box: Box, scale: number, clean: boolean): HTMLCanvasElement {
	const m = 4, pad = clean ? 20 : 0;
	const x = Math.max(0, Math.floor(box.x - m)), y = Math.max(0, Math.floor(box.y - m));
	const w = Math.min(bmp.width - x, Math.ceil(box.w + 2 * m)), h = Math.min(bmp.height - y, Math.ceil(box.h + 2 * m));
	const canvas = document.createElement('canvas');
	canvas.width = scale * w + 2 * pad;
	canvas.height = scale * h + 2 * pad;
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.filter = 'grayscale(1)';
	ctx.drawImage(bmp, x, y, w, h, pad, pad, scale * w, scale * h);
	// Inside a bubble only its letters matter: the art around them made clean lettering read as junk
	// ("Thank you!" came back as "cD" with the bar behind it in the crop, and right once the art was whitened).
	const all = ctx.getImageData(pad, pad, scale * w, scale * h);
	if (whitenOutside(all.data, scale * w, scale * h)) ctx.putImageData(all, pad, pad);
	if (clean) {
		const img = ctx.getImageData(pad, pad, scale * w, scale * h);
		const g = new Uint8ClampedArray(scale * w * scale * h);
		for (let i = 0; i < g.length; i++) g[i] = img.data[i * 4];
		stripBorders(g, scale * w, scale * h);
		for (let i = 0; i < g.length; i++) img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g[i];
		ctx.putImageData(img, pad, pad);
	}
	return canvas;
}

/**
 * Reads the English in one box: cropped with a small margin, doubled in size, in grey. When that reading is unsure, a
 * second one (3×, borders whitened, white margin, sparse-text mode) is tried and the more confident kept; measured on
 * 205 Black Jack boxes this raised similarity to the reference text from 0.76 to 0.83.
 */
export async function readBox(bmp: ImageBitmap, box: Box, model: Model = OCR_MODEL): Promise<{ text: string; conf: number }> {
	const worker = await getWorker(model);
	const read = async (c: HTMLCanvasElement) => {
		const { data } = await worker.recognize(c);
		return { text: data.text.replace(/\s+/g, ' ').trim(), conf: data.confidence };
	};
	const first = await read(crop(bmp, box, 2, false));
	if (first.conf >= SURE && looksEnglish(first.text, first.conf)) return first;
	const { PSM } = await import('tesseract.js');
	await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
	try {
		const second = await read(crop(bmp, box, 3, true));
		return second.conf > first.conf ? second : first;
	} finally {
		await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
	}
}
