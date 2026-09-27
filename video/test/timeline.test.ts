import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beatPulse, beats, beat, cues, DURATION, FPS, MUSIC, musicVolume, STAMP_AT } from '../src/timeline.ts';

test('beats are contiguous and fill exactly 21 seconds, in story order', () => {
	let at = 0;
	for (const b of beats) {
		assert.equal(b.from, at, `${b.id} starts at ${b.from}, expected ${at}`);
		at += b.duration;
	}
	assert.equal(at, DURATION);
	assert.equal(DURATION / FPS, 21);
	assert.deepEqual(beats.map((b) => b.id), ['title', 'fly', 'focus', 'expand', 'upload', 'result', 'wrong', 'report', 'end']);
});

test('every cut lands on the music beat grid', () => {
	const beatFrames = (FPS * 60) / MUSIC.bpm;
	for (const b of beats.slice(1)) {
		const k = (b.from - MUSIC.dropFrame) / beatFrames;
		assert.ok(Math.abs(k - Math.round(k)) * beatFrames <= 1, `${b.id} at ${b.from} is off the beat`);
	}
});

test('the WRONG stamp lands on the drop, and the music window fits the track', () => {
	assert.equal(beat('wrong').from + STAMP_AT, MUSIC.dropFrame);
	assert.ok(Math.abs(MUSIC.dropFrame / FPS + MUSIC.startSeconds - MUSIC.dropInTrackSeconds) < 1e-9);
	assert.ok(MUSIC.startSeconds >= 0 && MUSIC.startSeconds + DURATION / FPS <= MUSIC.trackSeconds);
});

test('every cue sits inside the video, and the thud lands with the stamp', () => {
	for (const c of cues) assert.ok(c.at >= 0 && c.at < DURATION, `${c.sfx} at ${c.at}`);
	assert.equal(cues.find((c) => c.sfx === 'thud')!.at, MUSIC.dropFrame);
});

test('the glow pulses on the music beat and decays between beats', () => {
	assert.ok(Math.abs(beatPulse(MUSIC.dropFrame) - 1) < 1e-9);
	assert.ok(beatPulse(MUSIC.dropFrame + 8) < 0.3);
	for (let f = 0; f < DURATION; f++) assert.ok(beatPulse(f) >= 0 && beatPulse(f) <= 1);
});

test('the music fades in, ducks under the thud, and fades out to silence', () => {
	assert.ok(musicVolume(0) < musicVolume(30));
	assert.ok(musicVolume(MUSIC.dropFrame + 2) < musicVolume(MUSIC.dropFrame - 30));
	assert.equal(musicVolume(DURATION), 0);
});
