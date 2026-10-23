import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { LOOP_FPS, framesOf, loops, sizeOf, tallLoops } from '../src/loops/sizes.ts';

// Run after `pnpm render:loops`: checks the files the site actually serves.
const probe = (file: string) => {
	const r = spawnSync('pnpm', ['exec', 'remotion', 'ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { shell: true, encoding: 'utf8' });
	assert.equal(r.status, 0, r.stderr);
	return JSON.parse(r.stdout) as { format: { duration: string }; streams: { codec_type: string; width?: number; height?: number }[] };
};

for (const l of [...loops, ...tallLoops])
	test(`${l.id}: ${framesOf(l) / LOOP_FPS} s, ${sizeOf(l).width}×${sizeOf(l).height}, silent, ≤ 1.5 MB per 5 s, with a poster`, () => {
		const file = `../static/present/${l.id}.mp4`;
		const p = probe(file);
		assert.ok(Math.abs(Number(p.format.duration) - framesOf(l) / LOOP_FPS) <= 0.1, `duration ${p.format.duration}`);
		const v = p.streams.find((s) => s.codec_type === 'video')!;
		assert.deepEqual([v.width, v.height], [sizeOf(l).width, sizeOf(l).height]);
		assert.ok(!p.streams.some((s) => s.codec_type === 'audio'), 'has audio');
		assert.ok(statSync(file).size / 1024 / 1024 <= 1.5 * (framesOf(l) / LOOP_FPS / 5), `${(statSync(file).size / 1024 / 1024).toFixed(2)} MB`);
		assert.ok(existsSync(`../static/present/${l.id}.jpg`), 'no poster');
	});
