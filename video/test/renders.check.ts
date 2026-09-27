import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';

const probe = (file: string) => {
	const r = spawnSync('pnpm', ['exec', 'remotion', 'ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { shell: true, encoding: 'utf8' });
	assert.equal(r.status, 0, r.stderr);
	return JSON.parse(r.stdout) as { format: { duration: string }; streams: { codec_type: string; width?: number; height?: number }[] };
};

const files = [
	{ file: 'out/intro-wide.mp4', w: 1920, h: 1080 },
	{ file: 'out/intro-square.mp4', w: 1080, h: 1080 },
	{ file: 'out/intro-tall.mp4', w: 1080, h: 1920 }
];

for (const f of files)
	test(`${f.file}: 15 s, ${f.w}×${f.h}, with sound`, () => {
		const p = probe(f.file);
		assert.ok(Math.abs(Number(p.format.duration) - 15) <= 0.1, `duration ${p.format.duration}`);
		const video = p.streams.find((s) => s.codec_type === 'video')!;
		assert.deepEqual([video.width, video.height], [f.w, f.h]);
		assert.ok(p.streams.some((s) => s.codec_type === 'audio'), 'no audio stream');
	});

test('site copies meet their size targets', () => {
	const mb = (p: string) => statSync(p).size / 1024 / 1024;
	assert.ok(mb('../static/intro/intro-wide.mp4') <= 3, `wide ${mb('../static/intro/intro-wide.mp4').toFixed(2)} MB`);
	assert.ok(mb('../static/intro/intro-tall.mp4') <= 2, `tall ${mb('../static/intro/intro-tall.mp4').toFixed(2)} MB`);
	for (const p of ['../static/intro/poster-wide.jpg', '../static/intro/poster-tall.jpg']) assert.ok(statSync(p).size > 0, p);
});
