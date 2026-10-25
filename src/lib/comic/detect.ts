import { ENGINE_MB, openSession, type Ort } from '$lib/runtime/engine';
import type { Box, RegionClass } from './types';

/** Our D-FINE text detector (plan 2, Apache-2.0), exported at 1024 px. Runs on the visitor's device. */
export const MODEL_URL = '/models/comic-text-detector.onnx';
export const MODEL_MB = 15.8;
export const CLASSES: RegionClass[] = ['bubble', 'caption', 'sfx', 'art-text'];
export const MIN_SCORE = 0.3;
const SIZE = 1024;

export interface Detection { box: Box; cls: RegionClass; score: number }

/** One tile for an ordinary page; overlapping squares down a tall (webtoon) page, the last one flush with the bottom. */
export function tiles(w: number, h: number): Box[] {
	if (h <= 1.5 * w) return [{ x: 0, y: 0, w, h }];
	const out: Box[] = [];
	for (let y = 0; y + w < h; y += Math.round(0.75 * w)) out.push({ x: 0, y, w, h: w });
	out.push({ x: 0, y: h - w, w, h: w });
	return out;
}

const overlapOfSmaller = (a: Box, b: Box) => {
	const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
	const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
	return (ix * iy) / Math.min(a.w * a.h, b.w * b.h);
};

/**
 * A bubble cut by a tile edge comes back as two boxes from neighbouring tiles: same kind and overlapping, they
 * become one (their union, the higher score). Boxes from the same tile are never merged (those are separate bubbles).
 */
export function mergeBoxes(dets: (Detection & { tile: number })[], minOverlap = 0.3): Detection[] {
	const left = [...dets].sort((a, b) => b.score - a.score);
	const out: (Detection & { tiles: Set<number> })[] = [];
	for (const d of left) {
		const twin = out.find((o) => o.cls === d.cls && !o.tiles.has(d.tile) && overlapOfSmaller(o.box, d.box) >= minOverlap);
		if (!twin) {
			out.push({ box: { ...d.box }, cls: d.cls, score: d.score, tiles: new Set([d.tile]) });
			continue;
		}
		const x = Math.min(twin.box.x, d.box.x), y = Math.min(twin.box.y, d.box.y);
		twin.box = { x, y, w: Math.max(twin.box.x + twin.box.w, d.box.x + d.box.w) - x, h: Math.max(twin.box.y + twin.box.h, d.box.y + d.box.h) - y };
		twin.tiles.add(d.tile);
	}
	return out.map(({ box, cls, score }) => ({ box, cls, score }));
}

/** A box that wraps two or more boxes of its own kind (each 80%+ inside it) is a duplicate of them: drop it. */
export function dropContainers(dets: Detection[]): Detection[] {
	return dets.filter((d) => dets.filter((o) => o !== d && o.cls === d.cls && overlapOfSmaller(o.box, d.box) >= 0.8
		&& o.box.w * o.box.h < d.box.w * d.box.h).length < 2);
}

/** The detector has no overlap removal of its own and often boxes one piece of text twice (as a bubble and as a
 * caption, or twice as a bubble). Keeps the more confident of any two boxes that overlap by IoU >= 0.5. */
export function dropTwins(dets: Detection[]): Detection[] {
	const iou = (a: Box, b: Box) => {
		const i = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
		return i / (a.w * a.h + b.w * b.h - i);
	};
	const kept: Detection[] = [];
	for (const d of [...dets].sort((a, b) => b.score - a.score)) if (kept.every((k) => iou(k.box, d.box) < 0.5)) kept.push(d);
	return kept;
}

/** Everything after the model: merge across tiles, drop wrappers, skip sound effects (the owner leaves them in the
 * art), then keep one box per piece of text. Sound effects go before the twins, so one can't win over a bubble. */
export function cleanUp(found: (Detection & { tile: number })[]): Detection[] {
	return dropTwins(dropContainers(mergeBoxes(found)).filter((d) => d.cls !== 'sfx'));
}

function tensorOf(bmp: ImageBitmap, t: Box): Float32Array {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	ctx.drawImage(bmp, t.x, t.y, t.w, t.h, 0, 0, SIZE, SIZE);
	const px = ctx.getImageData(0, 0, SIZE, SIZE).data;
	const plane = SIZE * SIZE;
	const out = new Float32Array(3 * plane);
	for (let i = 0; i < plane; i++) {
		out[i] = px[4 * i] / 255;
		out[plane + i] = px[4 * i + 1] / 255;
		out[2 * plane + i] = px[4 * i + 2] / 255;
	}
	return out;
}

function create() {
	let ort: Ort | undefined;
	let session: import('onnxruntime-web/wasm').InferenceSession | undefined;
	return {
		sizeLabel: `${MODEL_MB} MB model + ${ENGINE_MB} MB engine`,
		async load(onProgress: (p: number | null) => void) {
			if (session) return;
			({ ort, session } = await openSession(MODEL_URL, MODEL_MB, onProgress));
		},
		async detect(bmp: ImageBitmap): Promise<Detection[]> {
			if (!ort || !session) throw new Error('model not loaded');
			const found: (Detection & { tile: number })[] = [];
			for (const [tile, t] of tiles(bmp.width, bmp.height).entries()) {
				const out = await session.run({
					images: new ort.Tensor('float32', tensorOf(bmp, t), [1, 3, SIZE, SIZE]),
					orig_target_sizes: new ort.Tensor('int64', BigInt64Array.from([BigInt(t.w), BigInt(t.h)]), [1, 2])
				});
				const labels = out.labels.data as BigInt64Array, boxes = out.boxes.data as Float32Array, scores = out.scores.data as Float32Array;
				for (let i = 0; i < scores.length; i++) {
					if (scores[i] < MIN_SCORE) continue;
					const [x0, y0, x1, y1] = boxes.subarray(4 * i, 4 * i + 4);
					found.push({ box: { x: t.x + x0, y: t.y + y0, w: x1 - x0, h: y1 - y0 }, cls: CLASSES[Number(labels[i])], score: scores[i], tile });
				}
			}
			return cleanUp(found);
		}
	};
}

let shared: ReturnType<typeof create> | undefined;
/** One instance per page, so the model downloads once. */
export const comicDetector = () => (shared ??= create());
