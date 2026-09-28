import { statSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CLASSES, ENGINE_MB, MODEL_MB, MODEL_URL } from './sea-detector';
import { registry } from './index';

const mb = (path: string) => Math.round(statSync(path).size / 1e5) / 10;

it('the download size shown to visitors matches the real files', () => {
	expect(MODEL_MB).toBe(mb(`static${MODEL_URL}`));
	expect(ENGINE_MB).toBe(mb('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'));
});

it('knows the 14 creatures in the model’s output order', () => {
	expect(CLASSES).toEqual(['fish', 'jellyfish', 'penguin', 'puffin', 'shark', 'starfish', 'stingray', 'dolphin', 'whale', 'sea turtle', 'seahorse', 'sea lion', 'seal', 'crab']);
});

it('is registered for the live entry', () => {
	expect(typeof registry['sea-creature-detector']).toBe('function');
});
