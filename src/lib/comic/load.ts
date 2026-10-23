import { checkFile, readableImage } from '$lib/input-checks';

export const MAX_PDF_PAGES = 50;
const PDF_WIDTH = 1600;

export type Pages = { ok: true; count: number; page: (i: number) => Promise<ImageBitmap> } | { ok: false; reason: string };

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** Opens an image or a PDF in the browser. PDF pages render only when asked for, so a long book doesn't fill memory. */
export async function loadPages(file: File): Promise<Pages> {
	if (isPdf(file)) return loadPdf(file);
	const check = checkFile(file, 'image');
	if (!check.ok) return check;
	if (!(await readableImage(file))) return { ok: false, reason: 'That file isn’t a photo this browser can read. Try a JPG, PNG or WebP.' };
	const bmp = await createImageBitmap(file);
	return { ok: true, count: 1, page: async () => bmp };
}

async function loadPdf(file: File): Promise<Pages> {
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
			return createImageBitmap(canvas);
		}
	};
}
