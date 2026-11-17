import { whitenOutside } from './bubble';
import type { Box } from './types';

/** Which English model: picked by measurement in plan 3 task 3 (see training/comic_vendor.md). */
export const OCR_MODEL = 'best_int' as 'best_int' | 'standard';
export const OCR_MB = 7; // worker + one engine variant + English data, as downloaded by the browser (checked by a test)

/** Two-letter words that can stand alone in a bubble ("NO!", "OK?"); any other lone pair of letters is reader junk. */
const SHORT = new Set('ah ai am an as at be by do eh go ha he hi hm if in is it me my no of oh ok on or so to uh um up us we ya yo'.split(' '));

/** A confident reading with a real word (3+ letters, or a known two-letter one) and more letters than stray marks:
 * otherwise the visitor types the English. Empty bubbles read as "No / \ ~ 7" and got "translated". */
export function looksEnglish(text: string, conf: number): boolean {
	const letters = (text.match(/[A-Za-z]/g) ?? []).length;
	const marks = (text.match(/[^A-Za-z0-9\s.,!?'’"“”…:;$%&()#-]/g) ?? []).length; // numbers and their signs are fine ("IT'S 10:30!")
	const word = (text.match(/[A-Za-z]+/g) ?? []).some((w) => w.length >= 3 || SHORT.has(w.toLowerCase()));
	return conf >= 40 && word && letters > marks;
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

const MARGIN = 4, PAD = 20;
/** Paper filling less of the crop than this may be just the white outline round some letters on a see-through bubble
 * (18% on "OTHER PEOPLE…"; the smallest real bubbles in the labelled set fill 15–20%). */
const SEE_THROUGH = 0.25;
/** The page pixel at a crop's top-left corner (before scaling and the white margin). */
const origin = (box: Box) => ({ x: Math.max(0, Math.floor(box.x - MARGIN)), y: Math.max(0, Math.floor(box.y - MARGIN)) });

const letters = (t: string) => (t.match(/[A-Za-z]/g) ?? []).length;
const wordsOf = (t: string) => t.toUpperCase().match(/[A-Z']{2,}/g) ?? [];

/** Whether `washed` reads more of a see-through bubble than `sure`: it looks English, holds every word of `sure`, and has
 * half as many letters again. Its confidence is lower (48% on "OTHER PEOPLE…", with a little junk from the art around
 * it, which the translation fixes) so it can't win on confidence. */
export function readsMore(washed: { text: string; conf: number }, sure: { text: string }): boolean {
	const have = new Set(wordsOf(washed.text));
	return looksEnglish(washed.text, washed.conf) && wordsOf(sure.text).every((w) => have.has(w)) && letters(washed.text) >= 1.5 * letters(sure.text);
}

/** One crop of the box in grey, `scale`× larger; optionally with borders whitened and a white margin around it, and with
 * the screentone washed out (`tone`: blurred by a page pixel, then contrast raised, so the dots go grey and letters stay).
 * `shaped`: a bubble's paper fills the crop (false: see-through, or text on the art); the washed (`tone`) crop then
 * keeps the art, since whitening around a small patch of paper left one word of the bubble. */
function crop(bmp: ImageBitmap, box: Box, scale: number, clean: boolean, tone = false): { canvas: HTMLCanvasElement; shaped: boolean } {
	const m = MARGIN, pad = clean ? PAD : 0;
	const { x, y } = origin(box);
	const w = Math.min(bmp.width - x, Math.ceil(box.w + 2 * m)), h = Math.min(bmp.height - y, Math.ceil(box.h + 2 * m));
	const canvas = document.createElement('canvas');
	canvas.width = scale * w + 2 * pad;
	canvas.height = scale * h + 2 * pad;
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.filter = tone ? `grayscale(1) blur(${scale}px) contrast(2)` : 'grayscale(1)';
	ctx.drawImage(bmp, x, y, w, h, pad, pad, scale * w, scale * h);
	ctx.filter = 'none';
	// Inside a bubble only its letters matter: the art around them made clean lettering read as junk
	// ("Thank you!" came back as "cD" with the bar behind it in the crop, and right once the art was whitened).
	const all = ctx.getImageData(pad, pad, scale * w, scale * h);
	const least = tone ? SEE_THROUGH : 0, fill = whitenOutside(all.data, scale * w, scale * h, least);
	if (fill && fill >= least) ctx.putImageData(all, pad, pad);
	const shaped = fill >= SEE_THROUGH;
	if (clean) {
		const img = ctx.getImageData(pad, pad, scale * w, scale * h);
		const g = new Uint8ClampedArray(scale * w * scale * h);
		for (let i = 0; i < g.length; i++) g[i] = img.data[i * 4];
		stripBorders(g, scale * w, scale * h);
		for (let i = 0; i < g.length; i++) img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g[i];
		ctx.putImageData(img, pad, pad);
	}
	return { canvas, shaped };
}

/**
 * Reads the English in one box: cropped with a small margin, doubled in size, in grey. When that reading is unsure, a
 * second one (3×, borders whitened, white margin, sparse-text mode) is tried and the more confident kept; measured on
 * 205 Black Jack boxes this raised similarity to the reference text from 0.76 to 0.83. Still unsure: two more, 4× (small
 * lettering, as on an 880 px Garfield strip, read as junk at 2×) and with the screentone washed out. A box with no paper
 * filling it (a see-through bubble) always gets the washed reading too, kept by `readsMore` ("PEOPLE" at 90% was all of
 * "OTHER PEOPLE AREN'T JUST THINGS…" read). `words`: where each word read sits on the page.
 */
export async function readBox(bmp: ImageBitmap, box: Box, model: Model = OCR_MODEL): Promise<{ text: string; conf: number; words: Box[] }> {
	const worker = await getWorker(model);
	const { x, y } = origin(box);
	const read = async (scale: number, clean: boolean, tone = false) => {
		const { canvas, shaped } = crop(bmp, box, scale, clean, tone);
		const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
		const pad = clean ? PAD : 0;
		const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
			.filter((wd) => letters(wd.text) >= 2 || /^[IA]\W*$/.test(wd.text)) // a lone letter is junk from the art ("t" by a bubble's edge)
			.map(({ bbox: b }) => ({ x: x + (b.x0 - pad) / scale, y: y + (b.y0 - pad) / scale, w: (b.x1 - b.x0) / scale, h: (b.y1 - b.y0) / scale }));
		return { text: data.text.replace(/\s+/g, ' ').trim(), conf: data.confidence, words, shaped };
	};
	const sure = (r: { text: string; conf: number }) => r.conf >= SURE && looksEnglish(r.text, r.conf);
	const first = await read(2, false);
	let best = first;
	if (!sure(first)) {
		const { PSM } = await import('tesseract.js');
		await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
		try {
			const second = await read(3, true);
			if (second.conf > best.conf) best = second;
		} finally {
			await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
		}
		if (!sure(best)) {
			const big = await read(4, false);
			if (big.conf > best.conf) best = big;
		}
	}
	// No paper filling the box (a see-through bubble): a sure reading can be the one word the screentone left clear
	// ("PEOPLE" at 90%), so the washed-out reading is tried too.
	if (!first.shaped || !sure(best)) {
		const washed = await read(2, false, true);
		if (washed.conf > best.conf || (!first.shaped && readsMore(washed, best))) best = washed;
	}
	const { text, conf, words } = best;
	return { text, conf, words };
}
