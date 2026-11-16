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
		const { shape, hole, spans: local } = boxInside(img.data, rw, rh, r.cls);
		inpaint(img.data, rw, rh, hole);
		ctx.putImageData(img, rx, ry);
		const spans = local.map((sp): [number, number] | null => (sp ? [rx + sp[0], rx + sp[1]] : null));

		// Background colour for the ink: the bubble's, else the average of the box after erasing.
		let color = shape?.color;
		if (!color) {
			let sr = 0, sg = 0, sb = 0;
			for (let i = 0; i < rw * rh; i++) { sr += img.data[i * 4]; sg += img.data[i * 4 + 1]; sb += img.data[i * 4 + 2]; }
			color = `rgb(${[sr, sg, sb].map((v) => Math.round(v / (rw * rh))).join(',')})`;
		}

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

/**
 * One box's inside (RGBA crop, w×h): what to erase (`hole`, the English letters) and, per row, the span the Burmese may
 * use (crop x, or null). Bubbles and captions: the box's inside (any colour), its outline and the art past it never
 * erased or lettered over. Text on the art, or no clear box: the whole rectangle is the inside.
 */
export function boxInside(px: Uint8ClampedArray, w: number, h: number, cls: Region['cls']) {
	// A bubble packed with text has no clear paper in its middle: look for its paper over the whole box then.
	const shape = cls === 'free-text' ? null : (bubbleShape(px, w, h) ?? bubbleShape(px, w, h, { x: 0, y: 0, w, h }));
	const area = shape?.mask ?? new Uint8Array(w * h).fill(1);
	const { hole, outline } = shape ? letterPixels(px, w, h, area, true) : { hole: letterPixels(px, w, h, area), outline: null };
	// Each row's inside, through the middle column (a tail off to the side is left out), kept clear of the edge and of
	// the outline; rows run up and down from the middle until the outline.
	const room = outline ? area.map((v, i) => (v && !outline[i] ? 1 : 0)) : area;
	const cx = shape ? Math.round(shape.inner.x + shape.inner.w / 2) : w >> 1;
	let cy = shape ? Math.round(shape.inner.y + shape.inner.h / 2) : h >> 1;
	// The middle can land on the outline or outside the paper (a two-lobed bubble): start from the nearest row in the room.
	for (let d = 0; !room[cy * w + cx] && d < h; d++) {
		if (cy - d >= 0 && room[(cy - d) * w + cx]) cy -= d;
		else if (cy + d < h && room[(cy + d) * w + cx]) cy += d;
	}
	let top = cy, bottom = cy;
	while (top > 0 && room[(top - 1) * w + cx]) top--;
	while (bottom < h - 1 && room[(bottom + 1) * w + cx]) bottom++;
	const spans = Array.from({ length: h }, (_, y): [number, number] | null => {
		if (y < Math.max(PAD, top) || y > Math.min(h - PAD - 1, bottom) || !room[y * w + cx]) return null;
		let a = cx, b = cx;
		while (a > 0 && room[y * w + a - 1]) a--;
		while (b < w - 1 && room[y * w + b + 1]) b++;
		const p = Math.max(PAD, Math.round((b - a) * SIDE));
		return b - a > 2 * p ? [a + p, b - p] : null;
	});
	return { shape, hole, spans };
}
