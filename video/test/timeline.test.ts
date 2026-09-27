import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beats, beat, cues, DURATION, FPS, padVolume, STAMP_AT } from '../src/timeline.ts';

test('beats are contiguous and fill exactly 15 seconds', () => {
	let at = 0;
	for (const b of beats) {
		assert.equal(b.from, at, `${b.id} starts at ${b.from}, expected ${at}`);
		at += b.duration;
	}
	assert.equal(at, DURATION);
	assert.equal(DURATION / FPS, 15);
});

test('beat boundaries match the storyboard', () => {
	const secs = (id: Parameters<typeof beat>[0]) => beat(id).from / FPS;
	assert.deepEqual(
		[secs('fly'), secs('open'), secs('right'), secs('wrong'), secs('report'), secs('end')],
		[1.5, 4.5, 5.5, 8.5, 11, 13.5]
	);
});

test('every cue sits inside the video, and the thud lands with the stamp', () => {
	for (const c of cues) assert.ok(c.at >= 0 && c.at < DURATION, `${c.sfx} at ${c.at}`);
	const thud = cues.find((c) => c.sfx === 'thud')!;
	assert.equal(thud.at, beat('wrong').from + STAMP_AT);
	assert.equal(cues.filter((c) => c.sfx === 'tick' && c.at < beat('fly').from).length, 'AI MODEL LAB'.length);
});

test('the pad dips before the stamp and fades out at the end', () => {
	assert.ok(padVolume(270) < padVolume(200));
	assert.equal(padVolume(DURATION), 0);
});
