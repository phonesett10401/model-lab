// One-off: writes the draft audio samples. Re-run only if you change them.
import { mkdirSync, writeFileSync } from 'node:fs';

const rate = 16000;
function wav(samples) {
	const b = Buffer.alloc(44 + samples.length * 2);
	b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8);
	b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
	b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
	b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
	samples.forEach((s, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
	return b;
}
const secs = (s, f) => Array.from({ length: Math.round(rate * s) }, (_, i) => f(i / rate));
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

mkdirSync('static/samples', { recursive: true });
writeFileSync('static/samples/engine-hum.wav', wav(secs(2, (t) => 0.5 * Math.sin(2 * Math.PI * 90 * t) + 0.2 * Math.sin(2 * Math.PI * 180 * t))));
writeFileSync('static/samples/whale-call.wav', wav(secs(2.5, (t) => 0.6 * Math.sin(2 * Math.PI * (300 * t + 120 * t * t)) * Math.sin((Math.PI * t) / 2.5))));
writeFileSync('static/samples/bubbles.wav', wav(secs(2, (t) => rand() * (Math.sin(2 * Math.PI * 6 * t) > 0.7 ? 0.6 : 0.02))));
