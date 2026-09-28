// The engine files as Vite's own hashed, same-origin assets: one copy in the build, cached as immutable.
// (These imports are just URLs; nothing is fetched until a visitor runs a model.)
import engineUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import engineGlueUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';

export const ENGINE_URL = engineUrl;
export const ENGINE_MB = 14.2;
export type Ort = typeof import('onnxruntime-web/wasm');
type Session = import('onnxruntime-web/wasm').InferenceSession;

let engineReady = false; // once ONNX Runtime has started, a second model needs only its own file

/** Streams a file, reporting bytes received so far. */
async function fetchBytes(url: string, onBytes: (got: number) => void): Promise<Uint8Array> {
	const res = await fetch(url);
	if (!res.ok || !res.body) throw new Error(`download failed: ${url} ${res.status}`);
	const reader = res.body.getReader();
	const parts: Uint8Array[] = [];
	let got = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		parts.push(value);
		got += value.length;
		onBytes(got);
	}
	const bytes = new Uint8Array(got);
	let at = 0;
	for (const p of parts) { bytes.set(p, at); at += p.length; }
	return bytes;
}

/**
 * Downloads a model AND the engine ourselves, with one progress bar over both (the engine is the bigger part).
 * Handing ONNX Runtime the engine bytes means a dropped download just fails this try: if ONNX Runtime fetched
 * the engine itself and that failed, it would refuse every later try until the page was reloaded.
 */
export async function openSession(modelUrl: string, modelMB: number, onProgress: (p: number | null) => void): Promise<{ ort: Ort; session: Session }> {
	const ort = await import('onnxruntime-web/wasm');
	ort.env.wasm.wasmPaths = { mjs: engineGlueUrl, wasm: engineUrl };
	ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
	const total = (modelMB + (engineReady ? 0 : ENGINE_MB)) * 1e6; // sizes are checked against the real files by unit tests
	const got = { model: 0, engine: 0 };
	const report = () => onProgress(Math.min(1, (got.model + got.engine) / total));
	const [model, engine] = await Promise.all([
		fetchBytes(modelUrl, (n) => { got.model = n; report(); }),
		engineReady ? null : fetchBytes(ENGINE_URL, (n) => { got.engine = n; report(); })
	]); // a failed download throws here, so the caller's next try starts over
	if (engine) ort.env.wasm.wasmBinary = engine;
	const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
	engineReady = true;
	return { ort, session };
}
