// Renders one still per beat per layout into out/stills/ for review.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const frames = { title: 55, fly: 140, focus: 230, expand: 262, upload: 310, result: 400, wrong: 440, report: 540, end: 590 };
mkdirSync('out/stills', { recursive: true });
for (const layout of ['wide', 'square', 'tall'])
	for (const [beat, frame] of Object.entries(frames)) {
		const file = `out/stills/${layout}-${String(frame).padStart(3, '0')}-${beat}.jpg`;
		const r = spawnSync('pnpm', ['exec', 'remotion', 'still', 'src/index.ts', 'Intro', file, `--frame=${frame}`, `--props=props/${layout}.json`], { shell: true, stdio: 'inherit' });
		if (r.status !== 0) process.exit(r.status ?? 1);
	}
