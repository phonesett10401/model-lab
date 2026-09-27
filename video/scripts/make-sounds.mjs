// Synthesises every sound effect as a WAV (44.1 kHz, 16-bit mono). Deterministic: same files every run.
import { mkdirSync, writeFileSync } from 'node:fs';

const rate = 44100;
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const gen = (seconds, f) => Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => f(i / rate));
const lowpass = (x, coeffAt) => {
	let y = 0;
	return x.map((v, i) => (y += coeffAt(i / rate) * (v - y)));
};
const sines = (t, freqs) => freqs.reduce((a, f) => a + Math.sin(2 * Math.PI * f * t), 0) / freqs.length;

const sounds = {
	pad: gen(15.5, (t) => Math.min(1, t / 1.5) * Math.min(1, (15.5 - t) / 1.5) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.2 * t)) * 0.5 * sines(t, [110, 164.81, 220, 221.5])),
	tick: gen(0.04, (t) => rnd() * Math.exp(-t / 0.004) * 0.6),
	whoosh: lowpass(gen(0.7, (t) => rnd() * Math.sin((Math.PI * t) / 0.7) ** 2 * 0.9), (t) => 0.02 + 0.25 * (t / 0.7)),
	brake: lowpass(gen(0.6, (t) => rnd() * Math.exp(-t / 0.25) * 0.9), (t) => 0.3 * (1 - t / 0.6) + 0.01),
	clunk: gen(0.3, (t) => (Math.sin(2 * Math.PI * 95 * t) * 0.8 + rnd() * 0.2) * Math.exp(-t / 0.06)),
	scan: gen(2.2, (t) => Math.sin(2 * Math.PI * 660 * t) * 0.3 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 8 * t)) * Math.min(1, t / 0.1) * Math.min(1, (2.2 - t) / 0.2)),
	ding: gen(1.2, (t) => (Math.sin(2 * Math.PI * 1320 * t) + 0.4 * Math.sin(2 * Math.PI * 2640 * t)) * 0.5 * Math.exp(-t / 0.3)),
	thud: (() => {
		let phase = 0;
		return gen(0.7, (t) => {
			phase += (2 * Math.PI * (55 + 60 * Math.exp(-t / 0.05))) / rate;
			return (Math.sin(phase) * 0.9 + rnd() * 0.25 * Math.exp(-t / 0.02)) * Math.exp(-t / 0.18);
		});
	})(),
	paper: lowpass(gen(0.14, (t) => rnd() * Math.exp(-t / 0.03) * 0.9), () => 0.35),
	chord: gen(2.4, (t) => Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 0.4) / 0.9) * 0.8 * sines(t, [220, 277.18, 329.63, 440]))
};

function wav(x) {
	let peak = 0;
	for (const v of x) peak = Math.max(peak, Math.abs(v));
	const gain = peak > 0.95 ? 0.95 / peak : 1;
	const b = Buffer.alloc(44 + x.length * 2);
	b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVE', 8);
	b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
	b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
	b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
	x.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), 44 + i * 2));
	return b;
}

mkdirSync('public/sfx', { recursive: true });
for (const [name, x] of Object.entries(sounds)) {
	writeFileSync(`public/sfx/${name}.wav`, wav(x));
	console.log(`public/sfx/${name}.wav`);
}
