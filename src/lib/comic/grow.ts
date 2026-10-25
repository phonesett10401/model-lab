import { bubbleExtent } from './bubble';
import { joinSame, type Detection } from './detect';

/**
 * Grows each found bubble or caption box to the whole bubble around it, then merges boxes that land on the same bubble.
 * The finder sometimes boxes only part of a bubble ("See?" without "It wasn't so hard.") or splits one bubble in two
 * ("I said:" / "Gentlemen, …"); the bubble's own outline settles both. Text on art is left as found.
 */
export function growToBubbles(page: ImageBitmap, found: Detection[]): Detection[] {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	const grown = found.map((d) => {
		if (d.cls !== 'bubble' && d.cls !== 'caption') return d;
		const { x, y, w, h } = d.box;
		// A crop four times the box's size around it (a box can hold just the first line of a big bubble); the bubble's
		// paper is looked for inside the box itself, so light art elsewhere in the crop can't pass for it.
		const cx = Math.max(0, Math.floor(x - 1.5 * w)), cy = Math.max(0, Math.floor(y - 1.5 * h));
		const cw = Math.min(page.width - cx, Math.ceil(4 * w)), ch = Math.min(page.height - cy, Math.ceil(4 * h));
		if (cw < 8 || ch < 8) return d;
		canvas.width = cw;
		canvas.height = ch;
		ctx.drawImage(page, cx, cy, cw, ch, 0, 0, cw, ch);
		const e = bubbleExtent(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { x: x - cx, y: y - cy, w, h });
		return e ? { ...d, box: { x: cx + e.x, y: cy + e.y, w: e.w, h: e.h } } : d;
	});
	return joinSame(grown);
}
