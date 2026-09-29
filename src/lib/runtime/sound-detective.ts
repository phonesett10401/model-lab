import sounds from '$lib/data/sound-detective.json';
import type { ModelInput, Prediction } from '$lib/types';
import { peaks } from '$lib/waveform';
import { decode32kMono, MAX_SECONDS, MIN_SECONDS, SR, slices } from './audio';
import { ENGINE_MB, openSession, type Ort } from './engine';
import { toEvents } from './events';
import { UserError, type ClipInfo, type Runtime } from './index';

export const MODEL_URL = '/models/sound-detective-v1.onnx';
export const MODEL_MB = 20.5; // a unit test checks this against the real file
export const CLASSES: string[] = sounds.classes;
const THRESHOLDS: number[] = sounds.thresholds;

function create(): Runtime {
	let ort: Ort | undefined;
	let session: import('onnxruntime-web/wasm').InferenceSession | undefined;
	const rt: Runtime = {
		sizeLabel: `${MODEL_MB} MB model + ${ENGINE_MB} MB engine`,
		lastClip: null,
		thresholds: THRESHOLDS,
		labels: CLASSES,
		async load(onProgress) {
			if (session) return;
			({ ort, session } = await openSession(MODEL_URL, MODEL_MB, onProgress));
		},
		async scoreSlices(data, count) {
			if (!ort || !session) throw new Error('model not loaded');
			const out = await session.run({ audio: new ort.Tensor('float32', data, [count, SR]) });
			return out.scores.data as Float32Array;
		},
		async classify(input: ModelInput): Promise<Prediction[]> {
			if (input.type !== 'audio') throw new Error('the sound detective takes audio');
			const all = await decode32kMono(input.blob);
			if (all.length < MIN_SECONDS * SR) throw new UserError('Too short to hear anything. Record a little longer.');
			const x = all.subarray(0, MAX_SECONDS * SR);
			const { data, count } = slices(x);
			const scores = await rt.scoreSlices!(data, count);
			const clip: ClipInfo = { seconds: x.length / SR, trimmed: all.length > x.length, peaks: peaks(x, 120) };
			rt.lastClip = clip;
			return toEvents(scores, count, CLASSES, THRESHOLDS, clip.seconds);
		}
	};
	return rt;
}

let shared: Runtime | undefined;
/** One instance per page, so the model downloads once however many times the bench is shown. */
export const soundDetective = () => (shared ??= create());
