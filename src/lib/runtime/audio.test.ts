import { expect, it } from 'vitest';
import { encodeWav, slices, WIN } from './audio';

it('packs every slice into one batch, zero-padding the last', () => {
	const x = new Float32Array(50000).fill(0.5);
	const { data, count } = slices(x);
	expect(count).toBe(3);
	expect(data.length).toBe(3 * WIN);
	expect(data[2 * WIN + 17999]).toBe(0.5); // sample 49999 of the clip
	expect(data[2 * WIN + 18000]).toBe(0); // padding
});

it('writes a 16-bit mono WAV the browser can play', () => {
	const bytes = encodeWav(new Float32Array([0, 1, -1]), 32000);
	const v = new DataView(bytes.buffer);
	expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
	expect(v.getUint32(24, true)).toBe(32000);
	expect(v.getUint16(34, true)).toBe(16);
	expect(v.getInt16(46, true)).toBe(32767);
	expect(v.getInt16(48, true)).toBe(-32768);
	expect(bytes.length).toBe(44 + 6);
});
