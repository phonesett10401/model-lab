import { micErrorMessage } from '$lib/input-checks';
import { MAX_SECONDS, SR, STEP, WIN } from '$lib/runtime/audio';
import { toEvents } from '$lib/runtime/events';
import { UserError, type Runtime } from '$lib/runtime';
import type { Prediction } from '$lib/types';

export const LIVE_LIMIT_MS = 120_000;
const KEEP = MAX_SECONDS * SR;

export interface LiveView {
	predictions: Prediction[];
	/** Sounds in the newest slice. */
	now: string[];
	/** Seconds since listening began at the left edge of the 30 s view. */
	from: number;
	skipped: number;
}

/** Keeps the last 30 s of the stream, scores a 1 s slice every 0.5 s (skipping when still busy), builds the view. */
export class LiveScorer {
	private ring = new Float32Array(KEEP);
	private total = 0; // samples ever received
	private due = WIN; // score when this many samples have arrived
	private busy = false;
	private scored: { at: number; s: Float32Array }[] = []; // at = slice start, in stream samples
	skipped = 0;

	constructor(
		private score: (x: Float32Array) => Promise<Float32Array>,
		private labels: string[],
		private thresholds: number[],
		private onView: (v: LiveView) => void
	) {}

	push(chunk: Float32Array) {
		for (let i = 0; i < chunk.length; i++) this.ring[(this.total + i) % KEEP] = chunk[i];
		this.total += chunk.length;
		while (this.total >= this.due) {
			const at = this.due - WIN;
			this.due += STEP;
			if (this.busy) this.skipped++;
			else void this.run(at);
		}
	}

	private read(start: number, n: number): Float32Array {
		const out = new Float32Array(n);
		for (let i = 0; i < n; i++) out[i] = this.ring[(start + i) % KEEP];
		return out;
	}

	/** The last ≤30 s heard, oldest first. */
	samples(): Float32Array {
		const n = Math.min(this.total, KEEP);
		return this.read(this.total - n, n);
	}

	private async run(at: number) {
		this.busy = true;
		try {
			const s = await this.score(this.read(at, WIN));
			this.scored.push({ at, s });
			const oldest = this.total - KEEP;
			this.scored = this.scored.filter((x) => x.at >= oldest);
			this.onView(this.view());
		} finally {
			this.busy = false;
		}
	}

	private view(): LiveView {
		const n = this.labels.length;
		const first = this.scored[0].at;
		const last = this.scored.at(-1)!;
		const count = (last.at - first) / STEP + 1;
		const grid = new Float32Array(count * n); // skipped slices stay 0: nothing is claimed for moments not heard
		for (const x of this.scored) grid.set(x.s, ((x.at - first) / STEP) * n);
		const offset = first / SR;
		const predictions = toEvents(grid, count, this.labels, this.thresholds, (last.at + WIN - first) / SR)
			.map((p) => ({ ...p, start: p.start! + offset, end: p.end! + offset }));
		return {
			predictions,
			now: this.labels.filter((_, c) => last.s[c] >= this.thresholds[c]),
			from: Math.max(0, this.total / SR - MAX_SECONDS),
			skipped: this.skipped
		};
	}
}

/** Browser-only. Opens the mic and streams it through the model. Returns stop(); stopping hands back the last ≤30 s. */
export async function startListening(rt: Runtime, h: { onView(v: LiveView): void; onStop(samples: Float32Array): void }): Promise<() => void> {
	if (!rt.scoreSlices || !rt.labels || !rt.thresholds) throw new Error('this model cannot listen live');
	if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined')
		throw new UserError('Live listening isn’t supported in this browser. Record instead.');
	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
	} catch (err) {
		throw new UserError(micErrorMessage((err as DOMException).name));
	}
	let ctx: AudioContext | undefined;
	let node: AudioWorkletNode;
	try {
		ctx = new AudioContext({ sampleRate: SR }); // the browser resamples the mic to 32 kHz for us
		await ctx.audioWorklet.addModule('/worklets/capture.js');
		const source = ctx.createMediaStreamSource(stream);
		node = new AudioWorkletNode(ctx, 'capture');
		source.connect(node).connect(ctx.destination); // the worklet outputs silence; connecting keeps it running
	} catch {
		stream.getTracks().forEach((t) => t.stop());
		void ctx?.close();
		throw new UserError('Live listening isn’t supported in this browser. Record instead.');
	}
	const scorer = new LiveScorer((x) => rt.scoreSlices!(x, 1), rt.labels, rt.thresholds, h.onView);
	node.port.onmessage = (e: MessageEvent<Float32Array>) => scorer.push(e.data);
	let stopped = false;
	const onHide = () => { if (document.visibilityState === 'hidden') stop(); };
	const limit = setTimeout(stop, LIVE_LIMIT_MS);
	document.addEventListener('visibilitychange', onHide);
	function stop() {
		if (stopped) return;
		stopped = true;
		clearTimeout(limit);
		document.removeEventListener('visibilitychange', onHide);
		node.port.onmessage = null;
		stream.getTracks().forEach((t) => t.stop());
		void ctx!.close();
		h.onStop(scorer.samples());
	}
	return stop;
}
