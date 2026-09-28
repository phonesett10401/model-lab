// Serve ONNX Runtime's WebAssembly engine from the site itself (no third-party requests when a model runs).
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

const src = 'node_modules/onnxruntime-web/dist';
const files = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];
const have = new Set(readdirSync(src));
mkdirSync('static/ort', { recursive: true });
for (const f of files) {
	if (!have.has(f)) throw new Error(`${f} is missing from ${src}: onnxruntime-web changed its file layout`);
	copyFileSync(`${src}/${f}`, `static/ort/${f}`);
}
