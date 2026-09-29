import { statSync } from 'node:fs';
import { expect, it } from 'vitest';
import sounds from '$lib/data/sound-detective.json';
import { CLASSES, MODEL_MB, MODEL_URL } from './sound-detective';
import { registry } from './index';

const mb = (path: string) => Math.round(statSync(path).size / 1e5) / 10;

it('the download size shown to visitors matches the real file', () => expect(MODEL_MB).toBe(mb(`static${MODEL_URL}`)));
it('knows its sounds in the model’s output order', () => expect(CLASSES).toEqual(sounds.classes));
it('has one threshold per sound', () => expect(sounds.thresholds).toHaveLength(CLASSES.length));
it('is registered for the live entry', () => expect(typeof registry['sound-detective']).toBe('function'));
