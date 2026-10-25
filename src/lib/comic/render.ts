import { bubbleShape } from './bubble.ts';
import { eraseStyle, inkFor } from './erase.ts';
import { fitText, fontRange } from './fit.ts';
import type { Region } from './types.ts';

const FONT = '"Noto Sans Myanmar"';
const PAD = 4;
const LINE_HEIGHT = 1.7;

/** Draws the page, erases each translated box and letters its Burmese in. Counts are kept for the fitting score. */
export async function renderPage(
	ctx: CanvasRenderingContext2D, page: ImageBitmap, regions: Region[]
): Promise<{ fit: number; grown: number; cover: number; modes: Record<number, 'fit' | 'grown' | 'cover'> }> {
	await document.fonts.load(`16px ${FONT}`, 'မ');
	const counts = { fit: 0, grown: 0, cover: 0 };
	const modes: Record<number, 'fit' | 'grown' | 'cover'> = {};
	const full = { x: 0, y: 0, w: page.width, h: page.height };
	ctx.drawImage(page, 0, 0);
	// Two passes: every box is cleared first, then all the text is written, so a box that overlaps another can never
	// paint over its neighbour's Burmese.
	const texts: { fit: ReturnType<typeof fitText>; ink: string }[] = [];

	for (const r of regions) {
		const text = r.burmese.trim();
		if (!text) continue;
		const { x, y, w, h } = r.box;
		const rx = Math.round(x), ry = Math.round(y), rw = Math.max(1, Math.round(w)), rh = Math.max(1, Math.round(h));
		const img = ctx.getImageData(rx, ry, rw, rh);
		const erase = eraseStyle(img.data, r.cls);
		const inner = { x: x + PAD, y: y + PAD, w: Math.max(1, w - 2 * PAD), h: Math.max(1, h - 2 * PAD) };
		const measure = (s: string, size: number) => {
			ctx.font = `${size}px ${FONT}`;
			return ctx.measureText(s).width;
		};
		const opts = { ...fontRange(page.width), lineHeight: LINE_HEIGHT };
		// A speech bubble keeps its shape: only the paper inside the outline (and the letters on it) is painted over,
		// and the Burmese goes in the oval. If it doesn't fit there, the plain box below takes over.
		// Captions too: the finder often can't tell a boxed bubble from a caption, and both are paper inside an outline.
		const shape = r.cls === 'bubble' || r.cls === 'caption' ? bubbleShape(img.data, rw, rh) : null;
		// Once a bubble is found its outline always stays: the Burmese tries the oval's text area, a looser one, then a
		// smaller font; only if all fail does it get a paper-coloured patch behind the text (never the whole box).
		const inOval = (a: { x: number; y: number; w: number; h: number }, o = opts) => fitText(text, { x: rx + a.x, y: ry + a.y, w: a.w, h: a.h }, full, measure, o);
		const small = { ...opts, minSize: Math.max(9, Math.round(opts.minSize * 0.8)) };
		const tries = shape ? [inOval(shape.inner), inOval(shape.loose), inOval(shape.loose, small)] : [];
		const fit = shape ? (tries.find((t) => t.mode === 'fit') ?? tries[2]) : fitText(text, inner, full, measure, opts);
		counts[fit.mode]++;
		modes[r.id] = fit.mode;

		let ink = '#000';
		if (shape) {
			const [pr, pg, pb] = shape.color.match(/\d+/g)!.map(Number);
			for (let i = 0; i < shape.mask.length; i++)
				if (shape.mask[i]) img.data.set([pr, pg, pb, 255], i * 4);
			ctx.putImageData(img, rx, ry);
			if (fit.mode !== 'fit') {
				ctx.fillStyle = shape.color;
				ctx.fillRect(fit.box.x - PAD, fit.box.y - PAD, fit.box.w + 2 * PAD, fit.box.h + 2 * PAD);
			}
		} else if (erase.mode === 'fill' && fit.mode !== 'cover') {
			ctx.fillStyle = erase.color;
			ctx.fillRect(x, y, w, h);
			ink = inkFor(erase.color); // white on a dark caption
			if (fit.mode === 'grown') ctx.fillRect(fit.box.x, fit.box.y, fit.box.w, fit.box.h);
		} else {
			const b = fit.mode === 'fit' ? r.box : { x: fit.box.x - PAD, y: fit.box.y - PAD, w: fit.box.w + 2 * PAD, h: fit.box.h + 2 * PAD };
			ctx.fillStyle = '#fff';
			ctx.fillRect(b.x, b.y, b.w, b.h);
			ctx.strokeStyle = '#000';
			ctx.lineWidth = 2;
			ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
		}

		texts.push({ fit, ink });
	}
	for (const { fit, ink } of texts) {
		ctx.font = `${fit.size}px ${FONT}`;
		ctx.fillStyle = ink;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const step = fit.size * LINE_HEIGHT;
		const top = fit.box.y + (fit.box.h - fit.lines.length * step) / 2 + step / 2;
		fit.lines.forEach((line, i) => ctx.fillText(line.trim(), fit.box.x + fit.box.w / 2, top + i * step));
	}
	return { ...counts, modes };
}
