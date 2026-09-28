import type { ModelInput, Prediction } from '$lib/types';
import type { Runtime } from './index';
import { SIZE, decode, letterbox, nms, toOriginal } from './yolo';
// The engine files as Vite's own hashed, same-origin assets: one copy in the build, cached as immutable.
// (These imports are just URLs; nothing is fetched until a visitor runs the model.)
import engineUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import engineGlueUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';

export const MODEL_URL = '/models/sea-creature-detector-v2.onnx';
export const MODEL_MB = 9.8;
export const ENGINE_MB = 14.2;
export const CLASSES = ['fish', 'jellyfish', 'penguin', 'puffin', 'shark', 'starfish', 'stingray', 'dolphin', 'whale', 'sea turtle', 'seahorse', 'sea lion', 'seal', 'crab'];
const ANCHORS = 8400;
const CANDIDATE_CONF = 0.25; // the display threshold (entry.unsureBelow) is applied later; filtering after NMS is equivalent
const IOU = 0.7;

export const ENGINE_URL = engineUrl;

/** Streams a file, reporting bytes received so far. */
async function fetchBytes(url: string, onBytes: (got: number) => void): Promise<Uint8Array> {
	const res = await fetch(url);
	if (!res.ok || !res.body) throw new Error(`download failed: ${url} ${res.status}`);
	const reader = res.body.getReader();
	const parts: Uint8Array[] = [];
	let got = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		parts.push(value);
		got += value.length;
		onBytes(got);
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
			ort.env.wasm.wasmPaths = { mjs: engineGlueUrl, wasm: engineUrl };
			ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
			// Download the model AND the engine ourselves, with one progress bar over both (the engine is the bigger part).
			// Handing ONNX Runtime the engine bytes means a dropped download just fails this try: if ONNX Runtime fetched
			// the engine itself and that failed, it would refuse every later try until the page was reloaded.
			const total = (MODEL_MB + ENGINE_MB) * 1e6; // sizes are checked against the real files by a unit test
			const got = { model: 0, engine: 0 };
			const report = () => onProgress(Math.min(1, (got.model + got.engine) / total));
			const [model, engine] = await Promise.all([
				fetchBytes(MODEL_URL, (n) => { got.model = n; report(); }),
				fetchBytes(ENGINE_URL, (n) => { got.engine = n; report(); })
			]); // a failed download throws here: session stays unset, so the next try starts over
			ort.env.wasm.wasmBinary = engine;
			session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
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
