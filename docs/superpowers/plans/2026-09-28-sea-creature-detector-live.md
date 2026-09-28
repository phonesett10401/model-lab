# Sea Creature Detector Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the trained v2 sea creature detector (YOLO26 Nano, 14 creatures) on the site as the first real model, running in the visitor's browser, with a report card built only from measured numbers.

**Architecture:** A detector is a model entry with `task: 'detect'` whose predictions carry boxes. Pure, unit-tested YOLO maths (`letterbox`, `decode`, `nms`, `toOriginal`) sit in `src/lib/runtime/yolo.ts`; a runtime in `src/lib/runtime/sea-detector.ts` lazily loads `onnxruntime-web` (engine files self-hosted under `/ort/`) and the model from `/models/`. Report numbers, samples and failure examples are generated from the evaluation by a Python script into `src/lib/data/sea-creature-detector.json`, never typed by hand. The workbench draws boxes over the photo and lists what was found.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes + TypeScript, adapter-static, onnxruntime-web (WASM), Vitest, Playwright (Chromium + WebKit), Python 3.12 (conda env `modellab-train`, Ultralytics 8.4) for data generation.

**Spec:** `docs/superpowers/specs/2026-09-28-sea-creature-detector-live-design.md`

## Global Constraints

- Name "Sea creature detector"; slug `sea-creature-detector`; entry `no: 1`; permanent redirect from `/models/creature-categorizer`.
- Model file `static/models/sea-creature-detector-v2.onnx`, copied byte-for-byte from `training/runs/sea-v2-yolo26n/weights/best.onnx` (9.8 MB).
- Input 640×640 RGB float 0–1, letterboxed exactly like Ultralytics (`LetterBox`, centred, grey 114, Python rounding). Output `[1, 18, 8400]`, no NMS inside.
- Candidate confidence 0.25, per-class NMS IoU 0.7, max 300 detections; display threshold (`unsureBelow`) **0.45**.
- Class order: fish, jellyfish, penguin, puffin, shark, starfish, stingray, dolphin, whale, sea turtle, seahorse, sea lion, seal, crab.
- No number on the page unless it comes from the evaluation JSON. Only test-split photos are used as samples; each shows its credit (Aquarium: Roboflow, CC BY 4.0; Open Images: its Flickr author, CC BY 2.0).
- No third-party requests when a model runs: engine files are served from the site itself.
- `/` never requests the `.onnx` file or `/ort/` files until someone runs the model.
- Commits carry no Claude co-author or attribution lines.
- Git Bash heredocs mangle backticks and `${}`: write TS/Svelte/Python files with the Write/Edit tools.

## Review Focus

- **Phone photos with EXIF rotation** should get boxes on the creature as the visitor sees it (the `<img>` and `createImageBitmap` both apply EXIF orientation by default). Test: e2e runs an upright sample and an EXIF-rotated copy and expects the same labels.
- **A crowded photo (dozens of fish)** should stay readable: all boxes drawn, numbered tags only on the first 12, the list capped at 12 with "+N more". Test: e2e on the busiest sample checks the cap text.
- **A failed model download** (network drop) should show an error and let the next try succeed, without a half-loaded session. Test: e2e aborts the first `.onnx` request, then retries successfully.
- **A photo with no known creature** should say "No sea creatures found" and list the 14 it knows, not invent a label. Test: e2e runs `e2e/fixtures/not-a-creature.jpg` (plain grey image).
- **WebKit** (Safari engine) must run the WASM model too. Test: the e2e detector spec runs in both the chromium and webkit projects.

---

### Task 1: Detection types, bench mode and summary text

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/bench.ts`
- Modify: `src/lib/predictions.ts`
- Test: `src/lib/bench.test.ts` (create if absent; else append), `src/lib/predictions.test.ts` (create)

**Interfaces:**
- Produces: `Prediction.box?: [number, number, number, number]` (x0, y0, x1, y1 as fractions of the original photo); `ModelEntry.task?: 'classify' | 'detect'`; `Sample.credit?: string`; `BenchEvent` `done` gains `detect?: boolean`; `summarize(p: Prediction[]): string`; `plural(label: string, n: number): string`.

- [ ] **Step 1: Write the failing tests**

`src/lib/predictions.test.ts`:
```ts
import { expect, it } from 'vitest';
import { plural, summarize } from './predictions';

it('plurals: -fish words stay the same, others take s', () => {
	expect(plural('fish', 3)).toBe('fish');
	expect(plural('jellyfish', 2)).toBe('jellyfish');
	expect(plural('starfish', 2)).toBe('starfish');
	expect(plural('sea lion', 2)).toBe('sea lions');
	expect(plural('shark', 1)).toBe('shark');
});

it('summarizes detections by count, most first', () => {
	const p = (label: string) => ({ label, score: 0.9 });
	expect(summarize([p('shark'), p('fish'), p('fish'), p('fish')])).toBe('3 fish, 1 shark');
	expect(summarize([p('seal')])).toBe('1 seal');
	expect(summarize([p('seal'), p('seal'), p('crab'), p('crab')])).toBe('2 seals, 2 crabs');
	expect(summarize([])).toBe('');
});
```

Append to the bench tests (`src/lib/bench.test.ts`; if the file doesn't exist, create it with this import line first):
```ts
import { describe, expect, it } from 'vitest';
import { initialBench, step } from './bench';

describe('detection results', () => {
	const d = (label: string, score: number) => ({ label, score, box: [0, 0, 1, 1] as [number, number, number, number] });
	it('keeps every detection above the threshold, highest first, not just the top 3', () => {
		const s = step(initialBench, { type: 'done', detect: true, threshold: 0.45, predictions: [d('fish', 0.5), d('shark', 0.9), d('fish', 0.3), d('fish', 0.6), d('crab', 0.7)] });
		expect(s.kind === 'result' && s.predictions.map((p) => p.score)).toEqual([0.9, 0.7, 0.6, 0.5]);
		expect(s.kind === 'result' && s.unsure).toBe(false);
	});
	it('nothing above the threshold is "unsure" (nothing found)', () => {
		const s = step(initialBench, { type: 'done', detect: true, threshold: 0.45, predictions: [d('fish', 0.3)] });
		expect(s.kind === 'result' && s.predictions).toEqual([]);
		expect(s.kind === 'result' && s.unsure).toBe(true);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:unit --run src/lib/predictions.test.ts src/lib/bench.test.ts`
Expected: FAIL (`plural`/`summarize` not exported; detection test gets top-3 classifier behaviour).

- [ ] **Step 3: Implement**

`src/lib/types.ts`: change `Prediction` and add fields:
```ts
export interface Prediction {
	label: string;
	score: number;
	/** Detectors only: x0, y0, x1, y1 as fractions of the original photo. */
	box?: [number, number, number, number];
}
```
In `Sample` add after `knownFailure?: boolean;`:
```ts
	/** Who made the sample (photographer, dataset, licence). Shown with the sample. */
	credit?: string;
```
In `ModelEntry` add after `input: InputType;`:
```ts
	/** 'detect' draws boxes and lists everything found; default 'classify' shows the top answers. */
	task?: 'classify' | 'detect';
```

`src/lib/predictions.ts`: append
```ts
/** "fish" stays "fish" (as do jellyfish, starfish); other creatures take an s. */
export const plural = (label: string, n: number) => (n === 1 || label.endsWith('fish') ? label : `${label}s`);

/** "3 fish, 1 shark": counts per label, most first (ties keep first-seen order). */
export function summarize(p: Prediction[]): string {
	const counts = new Map<string, number>();
	for (const x of p) counts.set(x.label, (counts.get(x.label) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1]).map(([label, n]) => `${n} ${plural(label, n)}`).join(', ');
}
```

`src/lib/bench.ts`: change the `done` event type to
```ts
	| { type: 'done'; predictions: Prediction[]; threshold: number; detect?: boolean }
```
and the `done` case to
```ts
		case 'done': {
			if (e.detect) {
				// A detector reports everything it found above the threshold; nothing found is the "unsure" state.
				const predictions = e.predictions.filter((p) => p.score >= e.threshold).sort((a, b) => b.score - a.score);
				return { kind: 'result', predictions, unsure: predictions.length === 0 };
			}
			const predictions = topN(e.predictions);
			return { kind: 'result', predictions, unsure: isUnsure(predictions, e.threshold) };
		}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test:unit --run`
Expected: all unit tests PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/types.ts src/lib/bench.ts src/lib/predictions.ts src/lib/predictions.test.ts src/lib/bench.test.ts
git commit -m "feat: detection results (boxes, everything above threshold, summary text)"
```

---

### Task 2: YOLO maths (letterbox, decode, NMS, back to the photo)

**Files:**
- Create: `src/lib/runtime/yolo.ts`
- Test: `src/lib/runtime/yolo.test.ts`

**Interfaces:**
- Produces: `SIZE = 640`; `pyRound(x: number): number`; `letterbox(w: number, h: number, size?: number): { r: number; nw: number; nh: number; left: number; top: number }`; `type Candidate = { cls: number; score: number; box: [number, number, number, number] }` (box in 640-pixel input space, x0 y0 x1 y1); `decode(out: Float32Array, anchors: number, classes: number, conf: number): Candidate[]`; `nms(c: Candidate[], iou: number, maxDet?: number): Candidate[]`; `toOriginal(box, lb, w, h): [number, number, number, number]` (fractions, clipped to 0–1).

- [ ] **Step 1: Write the failing tests**

`src/lib/runtime/yolo.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decode, letterbox, nms, pyRound, toOriginal, type Candidate } from './yolo';

describe('letterbox (matches Ultralytics LetterBox)', () => {
	it('rounds halves to even, like Python', () => {
		expect([pyRound(2.5), pyRound(3.5), pyRound(-0.5), pyRound(2.4)]).toEqual([2, 4, -0, 2]);
	});
	it('fits a wide photo and centres it with grey bars top and bottom', () => {
		// 1024×768: r = 0.625 → 640×480, dh = 80 → top = round(79.9) = 80
		expect(letterbox(1024, 768)).toEqual({ r: 0.625, nw: 640, nh: 480, left: 0, top: 80 });
	});
	it('fits a tall photo with bars left and right', () => {
		// 768×1024: 480×640, dw = 80
		expect(letterbox(768, 1024)).toEqual({ r: 0.625, nw: 480, nh: 640, left: 80, top: 0 });
	});
	it('odd padding goes like Ultralytics: round(d - 0.1)', () => {
		// 640×639: r = 1 → 640×639, dh = 0.5 → top = round(0.4) = 0
		expect(letterbox(640, 639).top).toBe(0);
	});
});

describe('decode', () => {
	// 3 anchors, 2 classes → rows: cx, cy, w, h, class0, class1 (each row has 3 values)
	const out = new Float32Array([
		100, 300, 500, // cx
		100, 300, 500, // cy
		20, 40, 60, // w
		20, 40, 60, // h
		0.9, 0.1, 0.2, // class 0 scores
		0.05, 0.8, 0.1 // class 1 scores
	]);
	it('keeps each anchor’s best class above the confidence, with an x0 y0 x1 y1 box', () => {
		expect(decode(out, 3, 2, 0.25)).toEqual([
			{ cls: 0, score: expect.closeTo(0.9, 5), box: [90, 90, 110, 110] },
			{ cls: 1, score: expect.closeTo(0.8, 5), box: [280, 280, 320, 320] }
		]);
	});
});

describe('nms', () => {
	const c = (cls: number, score: number, box: [number, number, number, number]): Candidate => ({ cls, score, box });
	it('drops a lower box that overlaps a higher one of the same class by more than the IoU', () => {
		const kept = nms([c(0, 0.6, [0, 0, 100, 100]), c(0, 0.9, [5, 5, 105, 105]), c(0, 0.7, [300, 300, 400, 400])], 0.7);
		expect(kept.map((k) => k.score)).toEqual([0.9, 0.7]);
	});
	it('never suppresses across classes', () => {
		const kept = nms([c(0, 0.9, [0, 0, 100, 100]), c(1, 0.8, [0, 0, 100, 100])], 0.7);
		expect(kept.length).toBe(2);
	});
	it('caps at maxDet', () => {
		const many = Array.from({ length: 10 }, (_, i) => c(0, 1 - i / 100, [i * 200, 0, i * 200 + 50, 50] as [number, number, number, number]));
		expect(nms(many, 0.7, 4).length).toBe(4);
	});
});

describe('toOriginal', () => {
	it('undoes the letterbox and returns clipped fractions of the photo', () => {
		const lb = letterbox(1024, 768); // r .625, top 80
		// a box covering the whole image area in input space → the whole photo
		expect(toOriginal([0, 80, 640, 560], lb, 1024, 768)).toEqual([0, 0, 1, 1]);
		// a box spilling into the grey bar is clipped
		expect(toOriginal([-10, 0, 320, 320], lb, 1024, 768)).toEqual([0, 0, 0.5, expect.closeTo(0.5, 5)]);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:unit --run src/lib/runtime/yolo.test.ts`
Expected: FAIL (module `./yolo` not found).

- [ ] **Step 3: Implement**

`src/lib/runtime/yolo.ts`:
```ts
/**
 * YOLO detector maths, matching Ultralytics' own pre- and post-processing so the site shows
 * the same boxes the model was measured with. Pure functions: no DOM, no ONNX.
 */
export const SIZE = 640;

/** Python's round(): halves go to the even neighbour. Ultralytics' LetterBox rounds this way. */
export function pyRound(x: number): number {
	const f = Math.floor(x);
	const d = x - f;
	if (d !== 0.5) return Math.round(x);
	return f % 2 === 0 ? f : f + 1;
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
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test:unit --run src/lib/runtime/yolo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/runtime/yolo.ts src/lib/runtime/yolo.test.ts
git commit -m "feat: YOLO letterbox, decode and NMS matching Ultralytics"
```

---

### Task 3: Engine hosting, model asset and the detector runtime

**Files:**
- Modify: `package.json` (dependency + `dev`/`build` scripts), `vite.config.ts` (`optimizeDeps.exclude`)
- Create: `scripts/copy-ort.mjs`
- Modify: `.gitignore` (add `static/ort/`)
- Create: `static/models/sea-creature-detector-v2.onnx` (copy)
- Create: `src/lib/runtime/sea-detector.ts`
- Modify: `src/lib/runtime/index.ts` (registry)
- Test: `src/lib/runtime/sea-detector.test.ts`

**Interfaces:**
- Consumes: `SIZE`, `letterbox`, `decode`, `nms`, `toOriginal` (Task 2); `Prediction.box` (Task 1).
- Produces: `CLASSES: string[]`, `MODEL_URL`, `MODEL_MB`, `ENGINE_MB`, `seaDetector(): Runtime` (one shared instance per page); `registry['sea-creature-detector']`.

- [ ] **Step 1: Install and inspect the engine files**

Run: `pnpm add onnxruntime-web` then `ls -l node_modules/onnxruntime-web/dist | grep -E "ort-wasm-simd-threaded\.(wasm|mjs)$"`
Expected: both `ort-wasm-simd-threaded.wasm` and `ort-wasm-simd-threaded.mjs` listed. Note the `.wasm` size in MB (one decimal) for `ENGINE_MB`.

- [ ] **Step 2: Write the failing test**

`src/lib/runtime/sea-detector.test.ts`:
```ts
import { statSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CLASSES, ENGINE_MB, MODEL_MB, MODEL_URL } from './sea-detector';
import { registry } from './index';

const mb = (path: string) => Math.round(statSync(path).size / 1e5) / 10;

it('the download size shown to visitors matches the real files', () => {
	expect(MODEL_MB).toBe(mb(`static${MODEL_URL}`));
	expect(ENGINE_MB).toBe(mb('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'));
});

it('knows the 14 creatures in the model’s output order', () => {
	expect(CLASSES).toEqual(['fish', 'jellyfish', 'penguin', 'puffin', 'shark', 'starfish', 'stingray', 'dolphin', 'whale', 'sea turtle', 'seahorse', 'sea lion', 'seal', 'crab']);
});

it('is registered for the live entry', () => {
	expect(typeof registry['sea-creature-detector']).toBe('function');
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test:unit --run src/lib/runtime/sea-detector.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement**

Copy the model: `cp training/runs/sea-v2-yolo26n/weights/best.onnx static/models/sea-creature-detector-v2.onnx` (create `static/models/` first) and confirm with `cmp` that the bytes match.

`scripts/copy-ort.mjs`:
```js
// Serve ONNX Runtime's WebAssembly engine from the site itself (no third-party requests when a model runs).
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

const src = 'node_modules/onnxruntime-web/dist';
const files = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];
const have = new Set(readdirSync(src));
mkdirSync('static/ort', { recursive: true });
for (const f of files) {
	if (!have.has(f)) throw new Error(`${f} is missing from ${src}: onnxruntime-web changed its file layout`);
	copyFileSync(`${src}/${f}`, `static/ort/${f}`);
}
```
`package.json` scripts: `"dev": "node scripts/copy-ort.mjs && vite dev"`, `"build": "node scripts/copy-ort.mjs && vite build"`. `.gitignore`: add `static/ort/`. `vite.config.ts`: add `optimizeDeps: { exclude: ['onnxruntime-web'] },` next to `define` (Vite's dependency pre-bundling breaks onnxruntime-web's own file loading).

`src/lib/runtime/sea-detector.ts` (set `ENGINE_MB` to the value from Step 1; `MODEL_MB` is 9.8):
```ts
import type { ModelInput, Prediction } from '$lib/types';
import type { Runtime } from './index';
import { SIZE, decode, letterbox, nms, toOriginal } from './yolo';

export const MODEL_URL = '/models/sea-creature-detector-v2.onnx';
export const MODEL_MB = 9.8;
export const ENGINE_MB = 0; // replace with the measured .wasm size from Step 1
export const CLASSES = ['fish', 'jellyfish', 'penguin', 'puffin', 'shark', 'starfish', 'stingray', 'dolphin', 'whale', 'sea turtle', 'seahorse', 'sea lion', 'seal', 'crab'];
const ANCHORS = 8400;
const CANDIDATE_CONF = 0.25; // the display threshold (entry.unsureBelow) is applied later; filtering after NMS is equivalent
const IOU = 0.7;

async function fetchBytes(url: string, onProgress: (p: number | null) => void): Promise<Uint8Array> {
	const res = await fetch(url);
	if (!res.ok || !res.body) throw new Error(`model download failed: ${res.status}`);
	const total = Number(res.headers.get('content-length')) || 0;
	const reader = res.body.getReader();
	const parts: Uint8Array[] = [];
	let got = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		parts.push(value);
		got += value.length;
		onProgress(total ? got / total : null);
	}
	const bytes = new Uint8Array(got);
	let at = 0;
	for (const p of parts) { bytes.set(p, at); at += p.length; }
	return bytes;
}

function pixels(bmp: ImageBitmap): { tensor: Float32Array; lb: ReturnType<typeof letterbox> } {
	const lb = letterbox(bmp.width, bmp.height);
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	ctx.fillStyle = 'rgb(114,114,114)';
	ctx.fillRect(0, 0, SIZE, SIZE);
	ctx.drawImage(bmp, lb.left, lb.top, lb.nw, lb.nh);
	const px = ctx.getImageData(0, 0, SIZE, SIZE).data;
	const plane = SIZE * SIZE;
	const tensor = new Float32Array(3 * plane);
	for (let i = 0; i < plane; i++) {
		tensor[i] = px[4 * i] / 255;
		tensor[plane + i] = px[4 * i + 1] / 255;
		tensor[2 * plane + i] = px[4 * i + 2] / 255;
	}
	return { tensor, lb };
}

function create(): Runtime {
	type Ort = typeof import('onnxruntime-web/wasm');
	let ort: Ort | undefined;
	let session: import('onnxruntime-web/wasm').InferenceSession | undefined;
	return {
		sizeLabel: `${MODEL_MB} MB model + ${ENGINE_MB} MB engine`,
		async load(onProgress) {
			if (session) return;
			ort ??= await import('onnxruntime-web/wasm');
			ort.env.wasm.wasmPaths = '/ort/';
			ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
			const bytes = await fetchBytes(MODEL_URL, onProgress); // throws on a failed download: session stays unset, so the next try starts over
			session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
		},
		async classify(input: ModelInput): Promise<Prediction[]> {
			if (input.type !== 'image') throw new Error('the sea creature detector takes photos');
			if (!ort || !session) throw new Error('model not loaded');
			const bmp = await createImageBitmap(input.blob); // applies EXIF orientation, like the <img> the visitor sees
			const { tensor, lb } = pixels(bmp);
			const out = await session.run({ images: new ort.Tensor('float32', tensor, [1, 3, SIZE, SIZE]) });
			const data = out.output0.data as Float32Array;
			const found = nms(decode(data, ANCHORS, CLASSES.length, CANDIDATE_CONF), IOU);
			const result = found.map((d) => ({ label: CLASSES[d.cls], score: d.score, box: toOriginal(d.box, lb, bmp.width, bmp.height) }));
			bmp.close();
			return result;
		}
	};
}

let shared: Runtime | undefined;
/** One instance per page, so the model downloads once however many times the bench is shown. */
export const seaDetector = () => (shared ??= create());
```

`src/lib/runtime/index.ts`: replace the registry line with
```ts
/** Real models register here: slug → lazy import of their runtime. */
export const registry: Record<string, () => Promise<Runtime>> = {
	'sea-creature-detector': () => import('./sea-detector').then((m) => m.seaDetector())
};
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm test:unit --run` then `pnpm check`
Expected: unit tests PASS (the size test proves `ENGINE_MB` was filled in); `svelte-check` 0 errors.

- [ ] **Step 6: Commit**
```bash
git add package.json pnpm-lock.yaml vite.config.ts scripts/copy-ort.mjs .gitignore static/models/sea-creature-detector-v2.onnx src/lib/runtime/sea-detector.ts src/lib/runtime/sea-detector.test.ts src/lib/runtime/index.ts
git commit -m "feat: in-browser sea creature detector runtime (self-hosted ONNX Runtime)"
```

---

### Task 4: Measured data, samples and failures from the evaluation

**Files:**
- Create: `training/pick_examples.py`
- Create: `src/lib/data/sea-creature-detector.json` (generated)
- Create: `static/samples/sea/*.jpg` (copied test photos)
- Create: `training/attribution/sea-v2.csv` (copied from `training/data/sea-v2/attribution.csv`)

**Interfaces:**
- Consumes: `training/runs/sea-v2-yolo26n/weights/best.pt`, `training/runs/sea-v2-yolo26n/report/metrics.json`, `training/data/sea-v2/` (test split, attribution), `evaluate.compare`.
- Produces: JSON `{ classes: string[], threshold: 0.45, data: {label, value}[], metrics: Record<string, number>, samples: Sample[], failures: Failure[] }` where every sample has `id`, `title`, `input: {type:'image', src, alt}`, `credit`, `expected: Prediction[]` (with boxes), and failure samples have `knownFailure: true`.

- [ ] **Step 1: Write the script**

`training/pick_examples.py`:
```python
"""Pick the detector's sample and failure photos from the frozen TEST split, record the model's real
outputs for them, and write src/lib/data/sea-creature-detector.json for the site. No number here is typed by hand.

Usage: python pick_examples.py
"""
import csv
import json
import shutil
from collections import Counter
from pathlib import Path

from ultralytics import YOLO
from evaluate import compare, truth

HERE = Path(__file__).parent
DATA = HERE / 'data' / 'sea-v2'
RUN = HERE / 'runs' / 'sea-v2-yolo26n'
SITE = HERE.parent
OUT_JSON = SITE / 'src' / 'lib' / 'data' / 'sea-creature-detector.json'
OUT_IMG = SITE / 'static' / 'samples' / 'sea'
THRESHOLD = 0.45
SQUARE = dict(imgsz=640, rect=False)
PAIR_NOTES = {
    frozenset({'seal', 'sea lion'}): 'Seals and sea lions look alike, and it often swaps them.',
    frozenset({'whale', 'dolphin'}): 'Whales and dolphins share a shape; at a distance it can swap them.',
}


def credit(name, attr):
    a = attr[name]
    if a['source'].startswith('Aquarium'):
        return 'Photo: Roboflow, Aquarium Combined dataset · CC BY 4.0'
    return f"Photo: {a['author']} on Flickr, via Open Images · CC BY 2.0"


def main():
    model = YOLO(RUN / 'weights' / 'best.pt')
    names = model.names
    attr = {r['file']: r for r in csv.DictReader(open(DATA / 'attribution.csv', encoding='utf8'))}
    rows = []
    for img in sorted((DATA / 'images' / 'test').iterdir()):
        r = model.predict(img, conf=THRESHOLD, verbose=False, **SQUARE)[0]
        h, w = r.orig_shape
        gt = truth(DATA / 'labels' / 'test' / (img.stem + '.txt'), w, h)
        pred = [(int(c), tuple(b), float(s)) for c, b, s in zip(r.boxes.cls.tolist(), r.boxes.xyxy.tolist(), r.boxes.conf.tolist())]
        missed, false, wrong = compare(gt, pred)
        expected = [{'label': names[c], 'score': round(s, 4), 'box': [round(b[0] / w, 4), round(b[1] / h, 4), round(b[2] / w, 4), round(b[3] / h, 4)]}
                    for c, b, s in sorted(pred, key=lambda p: -p[2])]
        rows.append(dict(img=img, gt=gt, pred=pred, missed=missed, false=false, wrong=wrong, expected=expected,
                         classes={names[c] for c, _ in gt}))

    clean = [r for r in rows if not (r['missed'] or r['false'] or r['wrong']) and r['gt']]
    picks = []  # (id, title, row, failure)

    aq = [r for r in clean if r['img'].name.startswith('aq_')]
    busiest = max(aq, key=lambda r: (len(r['classes']), len(r['gt'])))
    picks.append(('aquarium', 'Aquarium tank', busiest, None))
    for cls, title in [('dolphin', 'Dolphin'), ('sea turtle', 'Sea turtle')]:
        only = [r for r in clean if r['img'].name.startswith('oi_') and r['classes'] == {cls}]
        best = max(only, key=lambda r: max((b[2] - b[0]) * (b[3] - b[1]) for _, b in r['gt']))
        picks.append((cls.replace(' ', '-'), title, best, None))

    for pair, title in [(('seal', 'sea lion'), 'Seal or sea lion?'), (('whale', 'dolphin'), 'Whale or dolphin?')]:
        cands = [r for r in rows if len(r['gt']) == 1 and r['wrong'] and {names[r['wrong'][0][0][0]], names[r['wrong'][0][1][0]]} == set(pair)]
        r = max(cands, key=lambda r: r['wrong'][0][1][2])
        (tc, _), (pc, _, ps) = r['wrong'][0]
        fail = {'truth': names[tc], 'said': names[pc], 'score': round(ps, 4), 'why': PAIR_NOTES[frozenset(pair)]}
        picks.append((pair[0].replace(' ', '-') + '-or-' + pair[1].replace(' ', '-'), title, r, fail))

    fishy = [r for r in rows if r['classes'] == {'fish'} and len(r['missed']) >= 2 and not r['false'] and not r['wrong'] and r['pred']]
    r = max(fishy, key=lambda r: len(r['missed']))
    n = len(r['missed'])
    fail = {'truth': f"{len(r['gt'])} fish", 'said': f"{len(r['pred'])} fish", 'score': round(max(p[2] for p in r['pred']), 4),
            'why': f'It missed {n} of the fish: small, distant or blurred fish are its most common miss.'}
    picks.append(('missed-fish', 'School of fish', r, fail))

    OUT_IMG.mkdir(parents=True, exist_ok=True)
    samples, failures = [], []
    for sid, title, r, fail in picks:
        shutil.copy2(r['img'], OUT_IMG / f'{sid}.jpg')
        creatures = ', '.join(sorted(r['classes']))
        s = {'id': sid, 'title': title, 'input': {'type': 'image', 'src': f'/samples/sea/{sid}.jpg', 'alt': f'Test photo showing {creatures}'},
             'credit': credit(r['img'].name, attr), 'expected': r['expected']}
        if fail:
            s['knownFailure'] = True
            failures.append({**fail, 'sampleId': sid})
        samples.append(s)

    report = json.loads((RUN / 'report' / 'metrics.json').read_text(encoding='utf8'))
    counts = Counter(s for s in ('train', 'val', 'test') for _ in (DATA / 'images' / s).iterdir())
    boxes = sum(1 for f in (DATA / 'labels').rglob('*.txt') for l in f.read_text().splitlines() if l.strip())
    data = [
        {'label': 'Sources', 'value': 'Aquarium Combined (Roboflow, CC BY 4.0) and Open Images V7 (CC BY 2.0)'},
        {'label': 'Photos', 'value': f"{sum(counts.values()):,} photos, {boxes:,} labelled creatures"},
        {'label': 'Split', 'value': f"{counts['train']:,} train · {counts['val']:,} validation · {counts['test']:,} test"},
        {'label': 'Base model', 'value': 'YOLO26 Nano (Ultralytics, AGPL-3.0), 2.5M parameters'},
        {'label': 'Test score', 'value': f"{report['overall']['mAP50']:.2f} mAP@50 on {report['test_images']} held-out photos"},
        {'label': 'Shows a creature from', 'value': f'{round(THRESHOLD * 100)}% confidence'},
        {'label': 'Known gaps', 'value': 'No octopus, manta ray or orca; mixes up seals and sea lions; misses small, distant fish'},
        {'label': 'Photo credits', 'value': 'Every training photo’s author is listed in training/attribution/sea-v2.csv in the project repository'},
    ]
    out = {'classes': [names[i] for i in sorted(names)], 'threshold': THRESHOLD, 'data': data,
           'metrics': {c: v['mAP50'] for c, v in report['per_class'].items()}, 'samples': samples, 'failures': failures}
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out, indent='\t', ensure_ascii=False) + '\n', encoding='utf8')
    (HERE / 'attribution').mkdir(exist_ok=True)
    shutil.copy2(DATA / 'attribution.csv', HERE / 'attribution' / 'sea-v2.csv')
    print('samples:', [s['id'] for s in samples])
    print('failures:', [(f['truth'], f['said'], f['score']) for f in failures])


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run it**

Run (PowerShell): `Set-Location training; & "C:\Users\phone\miniconda3\envs\modellab-train\python.exe" pick_examples.py`
Expected: prints 6 sample ids (`aquarium`, `dolphin`, `sea-turtle`, `seal-or-sea-lion`, `whale-or-dolphin`, `missed-fish`) and 3 failures; `static/samples/sea/` has 6 JPGs; the JSON has 14 `metrics` entries equal to `report/metrics.json` `per_class` mAP50.

- [ ] **Step 3: Look at the six photos**

Open each `static/samples/sea/*.jpg` and confirm it shows what its title says, contains no people's faces as the subject, and is a sensible public example. If one isn't, re-run with that candidate excluded (add its file name to a skip set in the script) and record a ruling.

- [ ] **Step 4: Commit**
```bash
git add training/pick_examples.py training/attribution/sea-v2.csv src/lib/data/sea-creature-detector.json static/samples/sea
git commit -m "feat: measured report data, samples and failures for the sea creature detector"
```

---

### Task 5: The live entry, renamed, with redirect, preview image and README

**Files:**
- Modify: `src/lib/entries.ts` (replace `creature`)
- Modify: `vercel.json`
- Create: `src/lib/redirects.test.ts`
- Modify: `src/lib/runtime/runtime.test.ts`, `e2e/archive.e2e.ts`, `e2e/pages.e2e.ts`, `e2e/workbench.e2e.ts`, `e2e/a11y.e2e.ts`
- Modify: `README.md`
- Delete: `static/og/creature-categorizer.png`; Create: `static/og/sea-creature-detector.png` (generated)

**Interfaces:**
- Consumes: the JSON from Task 4; `ModelEntry.task`, `Sample.credit` (Task 1).
- Produces: entry `sea-creature-detector` (`status: 'live'`, `task: 'detect'`, `unsureBelow: 0.45`).

- [ ] **Step 1: Write the failing tests**

`src/lib/redirects.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('the old detector address permanently redirects to the new one', () => {
	const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
	expect(cfg.redirects).toContainEqual({ source: '/models/creature-categorizer', destination: '/models/sea-creature-detector', permanent: true });
});
```
Update the existing tests to the new name (these fail until the entry changes):
- `src/lib/runtime/runtime.test.ts`: `'creature-categorizer'` → `'fresh-or-spoiled'` in "non-live models have no runtime".
- `e2e/archive.e2e.ts`: both `'Creature categorizer'` → `'Sea creature detector'`.
- `e2e/pages.e2e.ts`: slug `creature-categorizer` → `sea-creature-detector`, heading/title `Creature categorizer` → `Sea creature detector`, og regex `/\/og\/sea-creature-detector\.png$/`.
- `e2e/workbench.e2e.ts`: "a planned model is clearly not live" uses `/?entry=fresh-or-spoiled`.
- `e2e/a11y.e2e.ts`: `/models/creature-categorizer` → `/models/sea-creature-detector`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:unit --run`
Expected: FAIL on `redirects.test.ts` (no `redirects`) and `og.test.ts` stays passing until the slug changes.

- [ ] **Step 3: Implement**

`src/lib/entries.ts`: add at the top `import sea from './data/sea-creature-detector.json';` and extend the type import to `import type { AuditEntry, Entry, Failure, ModelEntry, Sample } from './types';`. Replace the whole `creature` constant with:
```ts
// Numbers, samples and failures come from the evaluation (training/pick_examples.py), never typed by hand.
const creature: ModelEntry = {
	kind: 'model', slug: 'sea-creature-detector', no: 1, name: 'Sea creature detector',
	purpose: 'Finds sea creatures in a photo, draws a box around each one and names it.',
	status: 'live', task: 'detect', input: 'image', labels: sea.classes, unsureBelow: sea.threshold,
	samples: sea.samples as Sample[],
	report: {
		data: sea.data,
		metrics: { title: 'Detection score per creature (mAP@50)', rows: Object.entries(sea.metrics).map(([label, value]) => ({ label, value })) },
		failures: sea.failures as Failure[]
	}
};
```
`vercel.json`: add
```json
	"redirects": [{ "source": "/models/creature-categorizer", "destination": "/models/sea-creature-detector", "permanent": true }]
```
`README.md`: the entry table row becomes `| 01 | Sea creature detector | image detector | live |`.

- [ ] **Step 4: Regenerate the link-preview image**

Run: `git rm static/og/creature-categorizer.png`, then `pnpm build`, then in another terminal `pnpm preview --port 4173`, then `pnpm og`; stop the preview server afterwards (PowerShell: `Get-NetTCPConnection -LocalPort 4173 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`).
Expected: `static/og/sea-creature-detector.png` written.

- [ ] **Step 5: Run to verify pass**

Run: `pnpm test:unit --run` and `pnpm check`
Expected: all PASS, 0 errors.

- [ ] **Step 6: Commit**
```bash
git add -A src/lib/entries.ts vercel.json src/lib/redirects.test.ts src/lib/runtime/runtime.test.ts e2e README.md static/og
git commit -m "feat: Sea creature detector goes live (renamed, redirect, measured report card)"
```

---

### Task 6: Boxes on the photo, the detection list and sample credits

**Files:**
- Modify: `src/lib/components/inputs/ImageInput.svelte` (box overlay)
- Create: `src/lib/components/DetectionList.svelte`
- Modify: `src/lib/components/Workbench.svelte`
- Modify: `src/lib/components/ReportCard.svelte` (failure score line)
- Create: `e2e/detector.e2e.ts`, `e2e/fixtures/not-a-creature.jpg`, `e2e/fixtures/rotated-dolphin.jpg`

**Interfaces:**
- Consumes: `summarize` (Task 1), entry + samples (Task 5), runtime (Task 3).
- Produces: `DetectionList` props `{ predictions: Prediction[]; max?: number }`; list items carry `data-label`, `data-score`, `data-box` for tests.

- [ ] **Step 1: Make the fixtures**

With the training env's Python (PIL): `not-a-creature.jpg` = a 640×480 plain grey (128,128,128) JPEG; `rotated-dolphin.jpg` = `static/samples/sea/dolphin.jpg` rotated 90° clockwise in pixels **plus** EXIF Orientation 8 (so it displays upright), saved with `exif=`. Record the script in the commit message, not the repo.

- [ ] **Step 2: Write the failing e2e test**

`e2e/detector.e2e.ts`:
```ts
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// The spec's parity check, done in the real browser: the page must reproduce the outputs Ultralytics recorded.
const sea = JSON.parse(readFileSync('src/lib/data/sea-creature-detector.json', 'utf8')) as {
	samples: { id: string; title: string; credit: string; expected: { label: string; score: number; box: number[] }[] }[];
};

test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(90_000); // first run downloads ~20 MB and compiles the engine

const demo = (page: Page) => page.locator('.demo');
const found = (page: Page) => page.locator('.dets li[data-label]').evaluateAll((els) => els.map((e) => ({
	label: e.getAttribute('data-label')!, score: Number(e.getAttribute('data-score')), box: JSON.parse(e.getAttribute('data-box')!) as number[]
})));
const iou = (a: number[], b: number[]) => {
	const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
	return (ix * iy) / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - ix * iy);
};

test('every sample gives the same creatures, scores and boxes the model was measured with', async ({ page }) => {
	await page.goto('/models/sea-creature-detector');
	for (const s of sea.samples) {
		await page.getByRole('button', { name: s.title, exact: true }).click();
		await expect(demo(page)).toHaveAttribute('data-state', /result|unsure/, { timeout: 60_000 });
		const got = await found(page);
		expect(got.map((g) => g.label).sort()).toEqual(s.expected.slice(0, got.length).map((e) => e.label).sort());
		for (const [i, e] of s.expected.slice(0, 12).entries()) {
			expect(Math.abs(got[i].score - e.score)).toBeLessThan(0.03);
			expect(iou(got[i].box, e.box)).toBeGreaterThan(0.9);
		}
		await expect(page.getByText(s.credit)).toBeVisible();
	}
});

test('boxes are drawn on the photo and the headline counts them', async ({ page }) => {
	await page.goto('/models/sea-creature-detector');
	await page.getByRole('button', { name: 'Dolphin', exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
	await expect(page.locator('.drop svg rect')).toHaveCount(sea.samples.find((s) => s.id === 'dolphin')!.expected.length);
	await expect(page.locator('.answer')).toHaveText(/^\d+ dolphins?$/);
});

test('a crowded photo lists the first 12 and says how many more', async ({ page }) => {
	const busiest = [...sea.samples].sort((a, b) => b.expected.length - a.expected.length)[0];
	test.skip(busiest.expected.length <= 12, 'no sample has more than 12 creatures');
	await page.goto('/models/sea-creature-detector');
	await page.getByRole('button', { name: busiest.title, exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
	await expect(page.locator('.dets li[data-label]')).toHaveCount(12);
	await expect(page.getByText(`+${busiest.expected.length - 12} more`)).toBeVisible();
});

test('a photo with no known creature says so and lists what it knows', async ({ page }) => {
	await page.goto('/models/sea-creature-detector');
	await page.locator('input[type=file]:not([capture])').setInputFiles('e2e/fixtures/not-a-creature.jpg');
	await expect(demo(page)).toHaveAttribute('data-state', 'unsure', { timeout: 60_000 });
	await expect(page.locator('.answer')).toHaveText('No sea creatures found');
	await expect(page.getByText(/sea lion, seal, crab/)).toBeVisible();
});

test('an EXIF-rotated phone photo finds the same creatures as the upright one', async ({ page }) => {
	await page.goto('/models/sea-creature-detector');
	await page.getByRole('button', { name: 'Dolphin', exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
	const upright = (await found(page)).map((g) => g.label).sort();
	await page.locator('input[type=file]:not([capture])').setInputFiles('e2e/fixtures/rotated-dolphin.jpg');
	await expect(demo(page)).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
	expect((await found(page)).map((g) => g.label).sort()).toEqual(upright);
});

test('a failed download shows an error, and the next try works', async ({ page }) => {
	let first = true;
	await page.route('**/models/sea-creature-detector-v2.onnx', (route) => (first ? ((first = false), route.abort()) : route.continue()));
	await page.goto('/models/sea-creature-detector');
	await page.getByRole('button', { name: 'Dolphin', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('failed to run');
	await page.getByRole('button', { name: 'Dolphin', exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', 'result', { timeout: 60_000 });
});

test('the home page never downloads the model or the engine', async ({ page }) => {
	const heavy: string[] = [];
	page.on('request', (r) => { if (/\.onnx$|\/ort\//.test(r.url())) heavy.push(r.url()); });
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	expect(heavy).toEqual([]);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm exec playwright test e2e/detector.e2e.ts --project=chromium`
Expected: FAIL (no `.dets` list, no boxes, no credits).

- [ ] **Step 4: Implement**

`src/lib/components/DetectionList.svelte`:
```svelte
<script lang="ts">
	import Bar from './Bar.svelte';
	import type { Prediction } from '$lib/types';

	let { predictions, max = 12 }: { predictions: Prediction[]; max?: number } = $props();
	const shown = $derived(predictions.slice(0, max));
</script>

<ol class="dets" aria-label="Found in the photo">
	{#each shown as p, i (i)}
		<li class="det" data-label={p.label} data-score={p.score} data-box={JSON.stringify(p.box ?? [])}>
			<span class="n mono" aria-hidden="true">{i + 1}</span>
			<ol class="one"><Bar label={p.label} score={p.score} top={i === 0} /></ol>
		</li>
	{/each}
</ol>
{#if predictions.length > max}<p class="mono faint">+{predictions.length - max} more</p>{/if}

<style>
	.dets { display: grid; gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
	.det { display: grid; grid-template-columns: 1.6rem 1fr; align-items: center; gap: var(--space-1); }
	.n { color: var(--red); font-variant-numeric: tabular-nums; }
	.one { margin: 0; padding: 0; }
</style>
```

`ImageInput.svelte`: add prop `boxes = null` typed `boxes?: Prediction[] | null` (import `Prediction` type), track the photo's shape, and replace the `{#if shown}<img …>` branch with an overlay frame:
```svelte
	{#if shown}
		<div class="frame" style="--ar: {ar}">
			<img src={shown} alt="What you added, being examined" onload={(e) => (ar = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
			{#if boxes?.length}
				<svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
					{#each boxes as b, i (i)}
						{#if b.box}<rect x={b.box[0]} y={b.box[1]} width={b.box[2] - b.box[0]} height={b.box[3] - b.box[1]} />{/if}
					{/each}
				</svg>
				{#each boxes.slice(0, 12) as b, i (i)}
					{#if b.box}<span class="tag mono" aria-hidden="true" style="left: {b.box[0] * 100}%; top: {b.box[1] * 100}%">{i + 1} {b.label}</span>{/if}
				{/each}
			{/if}
		</div>
	{:else}
```
with `let ar = $state(4 / 3);` and styles replacing the old `img { position: absolute … }` rule:
```css
	.drop { container-type: size; }
	.frame { position: relative; width: min(100cqw, calc(100cqh * var(--ar))); aspect-ratio: var(--ar); }
	.frame img { display: block; width: 100%; height: 100%; background: var(--plate); }
	svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
	rect { fill: none; stroke: var(--red); stroke-width: 2px; vector-effect: non-scaling-stroke; }
	.tag { position: absolute; background: var(--red); color: var(--on-ink); font-size: 11px; line-height: 1.4; padding: 0 4px; white-space: nowrap; pointer-events: none; }
```

`Workbench.svelte`:
- `import DetectionList from './DetectionList.svelte';` and `import { summarize } from '$lib/predictions';`
- `const detect = $derived(entry.task === 'detect');` and `let shownCredit = $state<string | null>(null);`
- In `run`: `bench = step(bench, { type: 'done', predictions, threshold: entry.unsureBelow, detect });`
- In `runSample`: first line after `active = 'demo';` → `shownCredit = s.credit ?? null;`. `ImageInput`'s `onsubmit` for uploads: `onsubmit={(i) => { shownCredit = null; run(i); }}`.
- `ImageInput` gets `boxes={detect && bench.kind === 'result' ? bench.predictions : null}`; below it: `{#if shownCredit && entry.input === 'image'}<p class="mono faint credit">{shownCredit}</p>{/if}`.
- Result branch becomes:
```svelte
				{:else if bench.kind === 'result' && detect}
					<p class="answer serif">{bench.unsure ? 'No sea creatures found' : summarize(bench.predictions)}</p>
					{#if bench.unsure}
						<p class="note warn">Nothing it knows cleared {Math.round(entry.unsureBelow * 100)}% confidence. It looks for: {entry.labels.join(', ')}.</p>
					{:else}
						<DetectionList predictions={bench.predictions} />
						<p class="mono faint">Shows creatures it is at least {Math.round(entry.unsureBelow * 100)}% sure of.</p>
					{/if}
				{:else if bench.kind === 'result'}
```
(the existing classifier result branch follows unchanged). In the error branch, show `<DetectionList predictions={previous} />` when `detect`, else the existing `PredictionBars`.

`ReportCard.svelte`: the "said" line shows the score only when it's above zero: `<p class="mono said">said: {f.said}{f.score > 0 ? ` · ${pct(f.score)}%` : ''}</p>`.

- [ ] **Step 5: Run to verify pass**

Run: `pnpm exec playwright test e2e/detector.e2e.ts` (both projects)
Expected: PASS in chromium and webkit. If the only failure is the parity tolerance, stop and investigate the preprocessing (do not loosen the tolerance without a ledgered ruling that says why).

- [ ] **Step 6: Run everything**

Run: `pnpm test:unit --run`, `pnpm check`, then `pnpm test:e2e` (stop any stale preview on 4173 first).
Expected: all green, including a11y on `/models/sea-creature-detector`.

- [ ] **Step 7: Commit**
```bash
git add src/lib/components e2e/detector.e2e.ts e2e/fixtures/not-a-creature.jpg e2e/fixtures/rotated-dolphin.jpg
git commit -m "feat: draw detections on the photo, list them, credit sample photos"
```

---

### Task 7: Production checks and handoff

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`

- [ ] **Step 1: Production build contents**

Run: `VERCEL_ENV=production pnpm build`, then `grep -rl "Document assistant audit\|Pretend you are DAN" build/ || echo clean` and `ls -l build/models build/ort`.
Expected: `clean`; the model and both engine files present.

- [ ] **Step 2: Update the handoff**

In `HANDOFF.md`: the lab now has one live model (sea creature detector v2, `/models/sea-creature-detector`), how to retrain (`training/` scripts, env `modellab-train`), how to regenerate the report data (`training/pick_examples.py`), and that the repo is public (owner OK with drafts being visible in source).

- [ ] **Step 3: Commit**
```bash
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff covers the live detector and the training pipeline"
```
