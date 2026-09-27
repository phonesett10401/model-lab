import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { cues } from '../src/timeline.ts';

const names = ['pad', 'tick', 'whoosh', 'brake', 'clunk', 'scan', 'ding', 'thud', 'paper', 'chord'];

function read(name: string) {
	const b = readFileSync(`public/sfx/${name}.wav`);
	assert.equal(b.toString('ascii', 0, 4), 'RIFF');
	assert.equal(b.toString('ascii', 8, 12), 'WAVE');
	const rate = b.readUInt32LE(24);
	const samples = (b.length - 44) / 2;
	let peak = 0;
	for (let i = 44; i < b.length; i += 2) peak = Math.max(peak, Math.abs(b.readInt16LE(i)) / 32767);
	return { rate, seconds: samples / rate, peak };
}

test('every sound exists, is 44.1 kHz and never clips', () => {
	for (const n of names) {
		assert.ok(existsSync(`public/sfx/${n}.wav`), `${n}.wav missing`);
		const s = read(n);
		assert.equal(s.rate, 44100, n);
		assert.ok(s.seconds > 0.02, `${n} too short`);
		assert.ok(s.peak > 0.05 && s.peak <= 0.96, `${n} peak ${s.peak}`);
	}
});

test('the pad covers the whole video and every cue has a sound', () => {
	assert.ok(read('pad').seconds >= 15);
	for (const c of cues) assert.ok(names.includes(c.sfx), c.sfx);
});
