import type { ModelInput, Prediction } from '$lib/types';
import type { Runtime } from './index';
import { SIZE, decode, letterbox, nms, toOriginal } from './yolo';
import { ENGINE_MB, openSession, type Ort } from './engine';
export { ENGINE_MB, ENGINE_URL } from './engine';

export const MODEL_URL = '/models/sea-creature-detector-v2.onnx';
export const MODEL_MB = 9.8;
export const CLASSES = ['fish', 'jellyfish', 'penguin', 'puffin', 'shark', 'starfish', 'stingray', 'dolphin', 'whale', 'sea turtle', 'seahorse', 'sea lion', 'seal', 'crab'];
const ANCHORS = 8400;
const CANDIDATE_CONF = 0.25; // the display threshold (entry.unsureBelow) is applied later; filtering after NMS is equivalent
const IOU = 0.7;

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
	let ort: Ort | undefined;
	let session: import('onnxruntime-web/wasm').InferenceSession | undefined;
	return {
		sizeLabel: `${MODEL_MB} MB model + ${ENGINE_MB} MB engine`,
		async load(onProgress) {
			if (session) return;
			({ ort, session } = await openSession(MODEL_URL, MODEL_MB, onProgress));
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
