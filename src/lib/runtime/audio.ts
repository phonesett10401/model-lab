import { UserError } from './index';

export const SR = 32000;
export const WIN = SR;
export const STEP = SR / 2;
export const MAX_SECONDS = 30;
export const MIN_SECONDS = 0.5;

/** Start sample of every 1 s slice (same rule as training/sounds_common.py window_starts). */
export function windowStarts(n: number): number[] {
	const count = n <= WIN ? 1 : Math.ceil((n - WIN) / STEP) + 1;
	return Array.from({ length: count }, (_, i) => i * STEP);
}

/** All slices of a clip in one [count × WIN] batch; the last one is zero-padded. */
export function slices(x: Float32Array): { data: Float32Array; count: number } {
	const starts = windowStarts(x.length);
	const data = new Float32Array(starts.length * WIN);
	starts.forEach((s, i) => data.set(x.subarray(s, Math.min(x.length, s + WIN)), i * WIN));
	return { data, count: starts.length };
}

/** Browser-only: decode any audio the browser can read, mixed to mono at 32 kHz (decodeAudioData resamples to the context's rate). */
export async function decode32kMono(blob: Blob): Promise<Float32Array> {
	if (typeof OfflineAudioContext === 'undefined') throw new UserError('This browser can’t read audio. Try another browser.');
	const ctx = new OfflineAudioContext(1, 1, SR);
	const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
	if (audio.numberOfChannels === 1) return audio.getChannelData(0).slice();
	const out = new Float32Array(audio.length);
	for (let c = 0; c < audio.numberOfChannels; c++) {
		const ch = audio.getChannelData(c);
		for (let i = 0; i < out.length; i++) out[i] += ch[i] / audio.numberOfChannels;
	}
	return out;
}

/** 16-bit mono PCM WAV. */
export function encodeWav(x: Float32Array, sr = SR): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(44 + x.length * 2);
	const v = new DataView(bytes.buffer);
	const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
	text(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); text(8, 'WAVE');
	text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
	v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
	text(36, 'data'); v.setUint32(40, x.length * 2, true);
	x.forEach((s, i) => {
		const c = Math.max(-1, Math.min(1, s));
		v.setInt16(44 + i * 2, c < 0 ? c * 32768 : c * 32767, true);
	});
	return bytes;
}

export const wavBlob = (x: Float32Array, sr = SR) => new Blob([encodeWav(x, sr)], { type: 'audio/wav' });
