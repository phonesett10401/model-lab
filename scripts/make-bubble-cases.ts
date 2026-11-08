// Writes src/lib/comic/bubble-cases.json: small synthetic crops and the extent bubbleExtent gives for each, so the
// Python port (training/comic_bubble.py) is held to the same rule. Run once: node scripts/make-bubble-cases.ts
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { bubbleExtent } from '../src/lib/comic/bubble.ts';
import type { Box } from '../src/lib/comic/types.ts';

type Paint = (x: number, y: number) => readonly number[];
const busy = (x: number, y: number) => [(x * 37 + y * 91) % 256, (x * 53) % 256, (y * 71) % 256];
const oval = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
/** A bubble: paper `c` inside, a 2-ish px black outline, a bar of black letters in the middle, `out` around it. */
const bubble = (cx: number, cy: number, rx: number, ry: number, c: readonly number[], out: Paint): Paint => (x, y) => {
	const d = oval(x, y, cx, cy, rx, ry);
	if (d > 1.12) return out(x, y);
	if (d > 1) return [0, 0, 0];
	return Math.abs(y - cy) < 4 && Math.abs(x - cx) < rx / 2 && x % 5 < 3 ? [0, 0, 0] : c;
};

const cases: { name: string; w: number; h: number; seed: Box | null; paint: Paint }[] = [
	{ name: 'white bubble, grey art around', w: 96, h: 72, seed: null, paint: bubble(48, 36, 38, 27, [255, 255, 255], () => [110, 110, 110]) },
	{ name: 'cream bubble on busy art', w: 96, h: 72, seed: null, paint: bubble(48, 36, 38, 27, [250, 240, 215], busy) },
	{ name: 'small box seeded in a big bubble', w: 120, h: 96, seed: { x: 45, y: 34, w: 30, h: 16 }, paint: bubble(60, 52, 50, 36, [255, 255, 255], busy) },
	{ name: 'bubble runs off the crop', w: 96, h: 72, seed: null, paint: bubble(20, 36, 45, 30, [255, 255, 255], () => [110, 110, 110]) },
	{ name: 'painted sky is not paper', w: 96, h: 72, seed: null, paint: bubble(48, 36, 38, 27, [60, 140, 200], busy) },
	{ name: 'two touching bubbles, seed in the left', w: 128, h: 72, seed: { x: 26, y: 28, w: 24, h: 16 },
		paint: (x, y) => (x < 64 ? bubble(36, 36, 27, 26, [255, 255, 255], () => [110, 110, 110]) : bubble(92, 36, 27, 26, [255, 255, 255], () => [110, 110, 110]))(x, y) }
];

const out = cases.map(({ name, w, h, seed, paint }) => {
	const rgba = new Uint8ClampedArray(w * h * 4), rgb = new Uint8Array(w * h * 3);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const c = paint(x, y), i = y * w + x;
			rgba.set([...c, 255], i * 4);
			rgb.set(c, i * 3);
		}
	const e = bubbleExtent(rgba, w, h, seed ?? undefined);
	return { name, w, h, seed, rgb: deflateSync(rgb).toString('base64'), extent: e && [e.x, e.y, e.w, e.h] };
});
writeFileSync('src/lib/comic/bubble-cases.json', JSON.stringify(out, null, '\t') + '\n');
console.log(out.map((c) => `${c.name}: ${JSON.stringify(c.extent)}`).join('\n'));
