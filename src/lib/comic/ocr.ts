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

/** One Tesseract worker per page, loaded from /ocr/ on our own site (copied there by vite.config.ts). */
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

/** Reads the English in one box: cropped with a small margin, doubled in size, in grey. */
export async function readBox(bmp: ImageBitmap, box: Box, model: Model = OCR_MODEL): Promise<{ text: string; conf: number }> {
	const m = 4;
	const x = Math.max(0, Math.floor(box.x - m)), y = Math.max(0, Math.floor(box.y - m));
	const w = Math.min(bmp.width - x, Math.ceil(box.w + 2 * m)), h = Math.min(bmp.height - y, Math.ceil(box.h + 2 * m));
	const canvas = document.createElement('canvas');
	canvas.width = 2 * w;
	canvas.height = 2 * h;
	const ctx = canvas.getContext('2d')!;
	ctx.filter = 'grayscale(1)';
	ctx.drawImage(bmp, x, y, w, h, 0, 0, 2 * w, 2 * h);
	const { data } = await (await getWorker(model)).recognize(canvas);
	return { text: data.text.replace(/\s+/g, ' ').trim(), conf: data.confidence };
}
