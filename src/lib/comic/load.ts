import { checkFile, readableImage } from '$lib/input-checks';

export const MAX_PDF_PAGES = 50;
export const MAX_PDF_BYTES = 100 * 1024 * 1024;
const PDF_WIDTH = 1600;

/** `page(i)` returns a fresh bitmap the caller owns (close it when done); `destroy()` releases the file. */
export type Pages =
	| { ok: true; count: number; page: (i: number) => Promise<ImageBitmap>; destroy: () => void }
	| { ok: false; reason: string };

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** Opens an image or a PDF in the browser. PDF pages render only when asked for, so a long book doesn't fill memory. */
export async function loadPages(file: File): Promise<Pages> {
	if (isPdf(file)) return loadPdf(file);
	const check = checkFile(file, 'image');
	if (!check.ok) return check;
	if (!(await readableImage(file))) return { ok: false, reason: 'That file isn’t a photo this browser can read. Try a JPG, PNG or WebP.' };
	return { ok: true, count: 1, page: () => createImageBitmap(file), destroy: () => {} };
}

type Book = Extract<Pages, { ok: true }>;

/** File-name order that reads numbers as numbers, so page2 comes before page10. */
export const byName = (a: File, b: File) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

/** One book from several opened files: their pages follow each other. */
export function joinPages(parts: Book[]): Book {
	const at = (i: number) => {
		for (const p of parts) {
			if (i < p.count) return p.page(i);
			i -= p.count;
		}
		return Promise.reject(new RangeError('no such page'));
	};
	return { ok: true, count: parts.reduce((n, p) => n + p.count, 0), page: at, destroy: () => parts.forEach((p) => p.destroy()) };
}

/** Opens several images and PDFs as one book, in file-name order. One bad file stops it and says which. */
export async function loadFiles(files: File[]): Promise<Pages> {
	const parts: Book[] = [];
	const sorted = [...files].sort(byName);
	for (const file of sorted) {
		const got = await loadPages(file);
		if (!got.ok) {
			parts.forEach((p) => p.destroy());
			return sorted.length > 1 ? { ok: false, reason: `${file.name}: ${got.reason}` } : got;
		}
		parts.push(got);
	}
	const book = joinPages(parts);
	if (book.count > MAX_PDF_PAGES) {
		book.destroy();
		return { ok: false, reason: `That’s more than ${MAX_PDF_PAGES} pages. Choose fewer files.` };
	}
	return book;
}

async function loadPdf(file: File): Promise<Pages> {
	if (file.size > MAX_PDF_BYTES)
		return { ok: false, reason: `That PDF is too large (over ${MAX_PDF_BYTES / 1024 / 1024} MB). Split it and open one part at a time.` };
	// pdf.js loads only when a PDF is opened.
	const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
	pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
	const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
	let doc;
	try {
		doc = await task.promise;
	} catch {
		return { ok: false, reason: 'That PDF couldn’t be opened. It may be damaged or password-protected.' };
	}
	if (doc.numPages > MAX_PDF_PAGES) {
		await task.destroy();
		return { ok: false, reason: `That PDF has more than ${MAX_PDF_PAGES} pages. Split it and open one part at a time.` };
	}
	return {
		ok: true,
		count: doc.numPages,
		page: async (i) => {
			const p = await doc.getPage(i + 1);
			const viewport = p.getViewport({ scale: PDF_WIDTH / p.getViewport({ scale: 1 }).width });
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(viewport.width);
			canvas.height = Math.round(viewport.height);
			await p.render({ canvas, viewport }).promise;
			p.cleanup();
			return createImageBitmap(canvas);
		},
		destroy: () => void task.destroy()
	};
}

/** Wraps page loads so only the newest one wins; a stale bitmap that finishes late is closed and gives null. */
export function latestOnly() {
	let last = 0;
	return async (p: Promise<ImageBitmap>): Promise<ImageBitmap | null> => {
		const mine = ++last;
		const bmp = await p;
		if (mine === last) return bmp;
		bmp.close();
		return null;
	};
}
