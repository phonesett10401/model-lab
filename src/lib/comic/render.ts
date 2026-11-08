import { bubbleShape } from './bubble.ts';
import { inkFor } from './erase.ts';
import { fontRange } from './fit.ts';
import { inpaint, letterPixels } from './letters.ts';
import { fitShaped } from './shaped.ts';
import type { Region } from './types.ts';

const FONT = '"Noto Sans Myanmar"';
/** Room kept between the Burmese and the box's edge, in pixels and as a share of each row's width. */
const PAD = 4;
const SIDE = 0.06;
const LINE_HEIGHT = 1.7;

export type Fits = 'fit' | 'small' | 'too-long';

/**
 * Draws the page and letters each translated box in place: only the English letters are erased (filled from the box's
 * own background), and the Burmese is set in lines shaped to the box. Nothing outside a box is ever changed. Returns
 * how each box's Burmese fitted: at the usual size, smaller, or too long even at the smallest size.
 */
export async function renderPage(ctx: CanvasRenderingContext2D, page: ImageBitmap, regions: Region[]): Promise<{ modes: Record<number, Fits> }> {
	await document.fonts.load(`16px ${FONT}`, 'မ');
	const modes: Record<number, Fits> = {};
	ctx.drawImage(page, 0, 0);
	const opts = { ...fontRange(page.width), floor: Math.max(6, Math.round(page.width * 0.006)), lineHeight: LINE_HEIGHT };
	const measure = (s: string, size: number) => {
		ctx.font = `${size}px ${FONT}`;
		return ctx.measureText(s).width;
	};
	// Two passes: every box is erased first, then all the text is written, so a box that overlaps another can never
	// erase its neighbour's Burmese.
	const texts: { r: Region; fit: ReturnType<typeof fitShaped>; ink: '#000' | '#fff'; clip: [number, number, number, number] }[] = [];

	for (const r of regions) {
		const text = r.burmese.trim();
		if (!text || r.cls === 'sfx') continue;
		const rx = Math.max(0, Math.round(r.box.x)), ry = Math.max(0, Math.round(r.box.y));
		const rw = Math.min(page.width, Math.round(r.box.x + r.box.w)) - rx, rh = Math.min(page.height, Math.round(r.box.y + r.box.h)) - ry;
		if (rw < 1 || rh < 1) continue;
		const img = ctx.getImageData(rx, ry, rw, rh);
		// Bubbles and captions: the box's inside (any colour), outline kept. Text on the art, or no clear box: the
		// whole found rectangle is the inside.
		// A bubble packed with text has no clear paper in its middle: look for its paper over the whole box then.
		const shape = r.cls === 'free-text' ? null : (bubbleShape(img.data, rw, rh) ?? bubbleShape(img.data, rw, rh, { x: 0, y: 0, w: rw, h: rh }));
		const area = shape?.mask ?? new Uint8Array(rw * rh).fill(1);
		const hole = letterPixels(img.data, rw, rh, area);
		inpaint(img.data, rw, rh, hole);
		ctx.putImageData(img, rx, ry);

		// Background colour for the ink: the bubble's, else the average of the box after erasing.
		let color = shape?.color;
		if (!color) {
			let sr = 0, sg = 0, sb = 0;
			for (let i = 0; i < rw * rh; i++) { sr += img.data[i * 4]; sg += img.data[i * 4 + 1]; sb += img.data[i * 4 + 2]; }
			color = `rgb(${[sr, sg, sb].map((v) => Math.round(v / (rw * rh))).join(',')})`;
		}

		// Each row's inside, through the middle column (a tail off to the side is left out), kept clear of the edge.
		const cx = shape ? Math.round(shape.inner.x + shape.inner.w / 2) : rw >> 1;
		const spans = Array.from({ length: rh }, (_, y): [number, number] | null => {
			if (y < PAD || y >= rh - PAD || !area[y * rw + cx]) return null;
			let a = cx, b = cx;
			while (a > 0 && area[y * rw + a - 1]) a--;
			while (b < rw - 1 && area[y * rw + b + 1]) b++;
			const p = Math.max(PAD, Math.round((b - a) * SIDE));
			return b - a > 2 * p ? [rx + a + p, rx + b - p] : null;
		});
		const fit = fitShaped(text, spans, ry, measure, opts);
		modes[r.id] = fit.fits;
		texts.push({ r, fit, ink: inkFor(color), clip: [rx, ry, rw, rh] });
	}

	for (const { r, fit, ink, clip } of texts) {
		ctx.save();
		ctx.beginPath();
		ctx.rect(...clip);
		ctx.clip();
		ctx.font = `${fit.size}px ${FONT}`;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = ink;
		// Text on the art gets a thin outline in the opposite colour so it reads without a box.
		const outline = r.cls === 'free-text';
		if (outline) {
			ctx.strokeStyle = ink === '#000' ? '#fff' : '#000';
			ctx.lineWidth = 4;
			ctx.lineJoin = 'round';
		}
		for (const l of fit.lines) {
			if (outline) ctx.strokeText(l.text, l.x, l.y);
			ctx.fillText(l.text, l.x, l.y);
		}
		ctx.restore();
	}
	return { modes };
}
