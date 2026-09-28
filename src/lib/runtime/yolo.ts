/**
 * YOLO detector maths, matching Ultralytics' own pre- and post-processing so the site shows
 * the same boxes the model was measured with. Pure functions: no DOM, no ONNX.
 */
export const SIZE = 640;

/** Python's round(): halves go to the even neighbour. Ultralytics' LetterBox rounds this way. */
export function pyRound(x: number): number {
	const f = Math.floor(x);
	const d = x - f;
	// "+ 0" turns -0 (from Math.round(-0.1)) into a plain 0.
	if (d !== 0.5) return Math.round(x) + 0;
	return (f % 2 === 0 ? f : f + 1) + 0;
}

export type Letterbox = { r: number; nw: number; nh: number; left: number; top: number };

/** Scale to fit a size×size square, centred, like Ultralytics LetterBox(auto=False, scaleup=True). */
export function letterbox(w: number, h: number, size = SIZE): Letterbox {
	const r = Math.min(size / h, size / w);
	const nw = pyRound(w * r);
	const nh = pyRound(h * r);
	return { r, nw, nh, left: pyRound((size - nw) / 2 - 0.1), top: pyRound((size - nh) / 2 - 0.1) };
}

export type Candidate = { cls: number; score: number; box: [number, number, number, number] };

/** Output layout [4 + classes, anchors]: cx, cy, w, h rows then one row per class score. */
export function decode(out: Float32Array, anchors: number, classes: number, conf: number): Candidate[] {
	const found: Candidate[] = [];
	for (let i = 0; i < anchors; i++) {
		let cls = 0;
		let score = out[4 * anchors + i];
		for (let c = 1; c < classes; c++) {
			const s = out[(4 + c) * anchors + i];
			if (s > score) { score = s; cls = c; }
		}
		if (score < conf) continue;
		const cx = out[i], cy = out[anchors + i], bw = out[2 * anchors + i], bh = out[3 * anchors + i];
		found.push({ cls, score, box: [cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2] });
	}
	return found;
}

function iou(a: Candidate['box'], b: Candidate['box']): number {
	const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
	const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
	const inter = ix * iy;
	return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter);
}

/** Per-class non-maximum suppression, highest score first (Ultralytics offsets boxes per class, which is the same thing). */
export function nms(c: Candidate[], threshold: number, maxDet = 300): Candidate[] {
	const kept: Candidate[] = [];
	for (const cand of [...c].sort((a, b) => b.score - a.score)) {
		if (kept.length >= maxDet) break;
		if (kept.every((k) => k.cls !== cand.cls || iou(k.box, cand.box) <= threshold)) kept.push(cand);
	}
	return kept;
}

/** Input-space box → fractions of the original photo, clipped to the photo (Ultralytics scale_boxes + clip). */
export function toOriginal(box: Candidate['box'], lb: Letterbox, w: number, h: number): [number, number, number, number] {
	const clip = (v: number, max: number) => Math.min(Math.max(v, 0), max);
	const x0 = clip((box[0] - lb.left) / lb.r, w), y0 = clip((box[1] - lb.top) / lb.r, h);
	const x1 = clip((box[2] - lb.left) / lb.r, w), y1 = clip((box[3] - lb.top) / lb.r, h);
	return [x0 / w, y0 / h, x1 / w, y1 / h];
}
