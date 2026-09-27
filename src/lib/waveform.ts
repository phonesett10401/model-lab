export function peaks(data: Float32Array, count: number): number[] {
	const size = Math.max(1, Math.floor(data.length / count));
	const out: number[] = [];
	for (let i = 0; i < count; i++) {
		let m = 0;
		for (let j = i * size; j < Math.min(data.length, (i + 1) * size); j++) m = Math.max(m, Math.abs(data[j]));
		out.push(m);
	}
	const max = Math.max(...out, 1e-6);
	return out.map((v) => v / max);
}

/** Browser-only. Throws if the audio can't be decoded; [] where Web Audio doesn't exist (no preview, still usable). */
export async function waveform(url: string, count = 48): Promise<number[]> {
	if (typeof AudioContext === 'undefined') return [];
	const buf = await fetch(url).then((r) => r.arrayBuffer());
	const ctx = new AudioContext();
	try {
		const audio = await ctx.decodeAudioData(buf);
		return peaks(audio.getChannelData(0), count);
	} finally {
		void ctx.close();
	}
}
