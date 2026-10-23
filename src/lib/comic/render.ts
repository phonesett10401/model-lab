import { eraseStyle } from './erase.ts';
import { fitText, fontRange } from './fit.ts';
import type { Region } from './types.ts';

const FONT = '"Noto Sans Myanmar"';
const PAD = 4;
const LINE_HEIGHT = 1.7;

/** Draws the page, erases each translated box and letters its Burmese in. Counts are kept for the fitting score. */
export async function renderPage(
	ctx: CanvasRenderingContext2D, page: ImageBitmap, regions: Region[]
): Promise<{ fit: number; grown: number; cover: number }> {
	await document.fonts.load(`16px ${FONT}`, 'မ');
	const counts = { fit: 0, grown: 0, cover: 0 };
	const full = { x: 0, y: 0, w: page.width, h: page.height };
	ctx.drawImage(page, 0, 0);

	for (const r of regions) {
		const text = r.burmese.trim();
		if (!text) continue;
		const { x, y, w, h } = r.box;
		const erase = eraseStyle(ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data, r.cls);
		const inner = { x: x + PAD, y: y + PAD, w: Math.max(1, w - 2 * PAD), h: Math.max(1, h - 2 * PAD) };
		const measure = (s: string, size: number) => {
			ctx.font = `${size}px ${FONT}`;
			return ctx.measureText(s).width;
		};
		const fit = fitText(text, inner, full, measure, { ...fontRange(page.width), lineHeight: LINE_HEIGHT });
		counts[fit.mode]++;

		if (erase.mode === 'fill' && fit.mode !== 'cover') {
			ctx.fillStyle = erase.color;
			ctx.fillRect(x, y, w, h);
			if (fit.mode === 'grown') ctx.fillRect(fit.box.x, fit.box.y, fit.box.w, fit.box.h);
		} else {
			const b = fit.mode === 'fit' ? r.box : { x: fit.box.x - PAD, y: fit.box.y - PAD, w: fit.box.w + 2 * PAD, h: fit.box.h + 2 * PAD };
			ctx.fillStyle = '#fff';
			ctx.fillRect(b.x, b.y, b.w, b.h);
			ctx.strokeStyle = '#000';
			ctx.lineWidth = 2;
			ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
		}

		ctx.font = `${fit.size}px ${FONT}`;
		ctx.fillStyle = '#000';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const step = fit.size * LINE_HEIGHT;
		const top = fit.box.y + (fit.box.h - fit.lines.length * step) / 2 + step / 2;
		fit.lines.forEach((line, i) => ctx.fillText(line.trim(), fit.box.x + fit.box.w / 2, top + i * step));
	}
	return counts;
}
