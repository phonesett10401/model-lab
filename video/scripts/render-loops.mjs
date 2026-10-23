// Renders the presentation's nine banner loops plus a poster each, straight into ../static/present/.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const ids = ['swarm', 'boxes', 'pipeline', 'device', 'sea', 'sound', 'rag', 'coming', 'site', 'pipeline-tall', 'rag-tall']; // loops then tallLoops in src/loops/sizes.ts (tested)
const only = process.argv.slice(2);
const run = (args) => {
	const r = spawnSync('pnpm', ['exec', 'remotion', ...args], { shell: true, stdio: 'inherit' });
	if (r.status !== 0) process.exit(r.status ?? 1);
};

mkdirSync('out/loops', { recursive: true });
mkdirSync('../static/present', { recursive: true });
for (const id of only.length ? only : ids) {
	run(['render', 'src/index.ts', `Loop-${id}`, `out/loops/${id}.mp4`, '--codec=h264', '--crf=24', '--muted']);
	// Site copy: a slower, tighter re-encode with no audio track (raise the CRF if loops.check.ts reports a file over 1.5 MB).
	run(['ffmpeg', '-hide_banner', '-y', '-i', `out/loops/${id}.mp4`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', `../static/present/${id}.mp4`]);
	run(['still', 'src/index.ts', `Loop-${id}`, `../static/present/${id}.jpg`, '--frame=0', '--jpeg-quality=80']);
}
console.log('rendered into static/present/');
