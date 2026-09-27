// Renders all three layouts plus posters, then copies the site's files into ../static/intro/.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';

const crf = { wide: 26, square: 22, tall: 28 }; // raise wide/tall CRF if a size target is missed
const run = (args) => {
	const r = spawnSync('pnpm', ['exec', 'remotion', ...args], { shell: true, stdio: 'inherit' });
	if (r.status !== 0) process.exit(r.status ?? 1);
};

mkdirSync('out', { recursive: true });
for (const layout of ['wide', 'square', 'tall'])
	run(['render', 'src/index.ts', 'Intro', `out/intro-${layout}.mp4`, `--props=props/${layout}.json`, '--codec=h264', '--audio-codec=aac', `--crf=${crf[layout]}`]);
for (const layout of ['wide', 'tall'])
	run(['still', 'src/index.ts', 'Intro', `out/poster-${layout}.jpg`, '--frame=230', `--props=props/${layout}.json`, '--jpeg-quality=80']);

mkdirSync('../static/intro', { recursive: true });
for (const f of ['intro-wide.mp4', 'intro-tall.mp4', 'poster-wide.jpg', 'poster-tall.jpg']) copyFileSync(`out/${f}`, `../static/intro/${f}`);
console.log('copied to static/intro/');
