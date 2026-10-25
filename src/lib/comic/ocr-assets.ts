// Node only (used by vite.config.ts and tests): Tesseract.js's worker, engine and English data, copied into
// static/ocr/ so the browser loads them from our own site, never a CDN.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkg = (name: string) => dirname(require.resolve(`${name}/package.json`));

/** Published name in /ocr/ -> source file. Only the LSTM engines are needed (we always use the LSTM model). */
export const OCR_FILES: Record<string, string> = (() => {
	const tjs = pkg('tesseract.js');
	const req = createRequire(join(tjs, 'package.json'));
	const coreDir = dirname(req.resolve('tesseract.js-core/package.json'));
	const data = pkg('@tesseract.js-data/eng');
	return {
		'worker.min.js': join(tjs, 'dist/worker.min.js'),
		...Object.fromEntries(readdirSync(coreDir).filter((f) => /^tesseract-core.*-?lstm\.wasm\.js$/.test(f)).map((f) => [f, join(coreDir, f)])),
		'eng/best_int/eng.traineddata.gz': join(data, '4.0.0_best_int/eng.traineddata.gz'),
		'eng/standard/eng.traineddata.gz': join(data, '4.0.0/eng.traineddata.gz')
	};
})();

/** Copies the OCR files into dest (default static/ocr), skipping ones already there with the same size. */
export function copyOcrAssets(root: string, dest = join(root, 'static/ocr')): void {
	for (const [name, from] of Object.entries(OCR_FILES)) {
		const to = join(dest, name);
		if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
		mkdirSync(dirname(to), { recursive: true });
		copyFileSync(from, to);
	}
}
