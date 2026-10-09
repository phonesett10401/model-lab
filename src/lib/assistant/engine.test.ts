import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CHAT_MODEL, CONTEXT_WINDOW, EMBED_MODEL } from './config';
import { checkGpu, explainError, LOAD_FAILED, NO_GPU, OUT_OF_MEMORY } from './engine';

const adapter = (features: string[]) => ({ requestAdapter: async () => ({ features: new Set(features) }) });

describe('checkGpu', () => {
	it('is happy with WebGPU and 16-bit shaders', async () => {
		expect(await checkGpu(adapter(['shader-f16']))).toBeNull();
	});
	it('says what is needed when WebGPU, an adapter or 16-bit shaders are missing', async () => {
		expect(await checkGpu(undefined)).toBe(NO_GPU);
		expect(await checkGpu({ requestAdapter: async () => null })).toBe(NO_GPU);
		expect(await checkGpu(adapter([]))).toBe(NO_GPU);
		expect(await checkGpu({ requestAdapter: async () => { throw new Error('blocked'); } })).toBe(NO_GPU);
	});
	it('uses the exact wording from the spec', () => {
		expect(NO_GPU).toBe('This assistant needs Chrome or Edge with graphics acceleration.');
	});
});

describe('explainError', () => {
	it('recognises running out of GPU memory', () => {
		expect(explainError(new Error('GPUOutOfMemoryError: out of memory'))).toBe(OUT_OF_MEMORY);
		expect(explainError(Object.assign(new Error('x'), { name: 'DeviceLostError' }))).toBe(OUT_OF_MEMORY);
	});
	it('falls back to the given message', () => {
		expect(explainError(new TypeError('Failed to fetch'))).toBe(LOAD_FAILED);
		expect(explainError('weird', 'Other.')).toBe('Other.');
	});
});

it('both model ids are in this WebLLM version’s built-in list', () => {
	const dir = 'node_modules/@mlc-ai/web-llm/';
	const pkg = JSON.parse(readFileSync(dir + 'package.json', 'utf8'));
	const code = readFileSync(dir + (pkg.module ?? pkg.main), 'utf8');
	expect(code).toContain(`"${CHAT_MODEL}"`);
	expect(code).toContain(`"${EMBED_MODEL}"`);
});

describe('webllmEngine', () => {
	it('loads the chat model with a 2,048-token window, so long messages fit in a phone’s memory', async () => {
		vi.resetModules();
		const created: [string, unknown, unknown][] = [];
		vi.doMock('@mlc-ai/web-llm', () => ({ CreateMLCEngine: async (model: string, cfg: unknown, opts: unknown) => { created.push([model, cfg, opts]); return {}; } }));
		const { webllmEngine } = await import('./engine');
		await webllmEngine().load(() => {});
		expect(created.map(([m]) => m)).toEqual([EMBED_MODEL, CHAT_MODEL]);
		expect(created[1][2]).toEqual({ context_window_size: CONTEXT_WINDOW });
		expect(CONTEXT_WINDOW).toBe(2048);
		vi.doUnmock('@mlc-ai/web-llm');
	});
});
