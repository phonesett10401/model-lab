import { describe, expect, it } from 'vitest';
import { isUnsure, sortMetrics, topN } from './predictions';
import { checkFile, micErrorMessage } from './input-checks';
import { latestOnly } from './latest';
import { initialBench, lastResult, step } from './bench';
import { segments } from './transcript';
import { peaks } from './waveform';

const preds = [{ label: 'b', score: 0.2 }, { label: 'a', score: 0.7 }, { label: 'c', score: 0.06 }, { label: 'd', score: 0.04 }];

describe('predictions', () => {
	it('keeps the top 3, highest first', () => {
		expect(topN(preds).map((p) => p.label)).toEqual(['a', 'b', 'c']);
	});
	it('is unsure below the threshold, or with nothing', () => {
		expect(isUnsure(preds, 0.6)).toBe(false);
		expect(isUnsure(preds, 0.75)).toBe(true);
		expect(isUnsure([], 0.5)).toBe(true);
	});
	it('lists the worst metric first and unmeasured last', () => {
		const rows = [{ label: 'x', value: 0.9 }, { label: 'y', value: null }, { label: 'z', value: 0.6 }];
		expect(sortMetrics(rows).map((r) => r.label)).toEqual(['z', 'x', 'y']);
		expect(sortMetrics(rows, true).map((r) => r.label)).toEqual(['x', 'z', 'y']);
	});
});

describe('file checks', () => {
	it('accepts supported images, including HEIC with no MIME type', () => {
		expect(checkFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 }, 'image')).toEqual({ ok: true });
		expect(checkFile({ name: 'IMG_1.HEIC', type: '', size: 10 }, 'image')).toEqual({ ok: true });
	});
	it('rejects wrong types and huge files with a plain reason', () => {
		const pdf = checkFile({ name: 'a.pdf', type: 'application/pdf', size: 10 }, 'image');
		expect(pdf.ok).toBe(false);
		expect(!pdf.ok && pdf.reason).toMatch(/JPG, PNG, WebP or HEIC/);
		const big = checkFile({ name: 'a.png', type: 'image/png', size: 50_000_000 }, 'image');
		expect(!big.ok && big.reason).toMatch(/too large/);
		expect(checkFile({ name: 'a.mp3', type: 'audio/mpeg', size: 10 }, 'audio')).toEqual({ ok: true });
	});
	it('explains microphone failures', () => {
		expect(micErrorMessage('NotAllowedError')).toMatch(/blocked/);
		expect(micErrorMessage('NotFoundError')).toMatch(/No microphone/);
		expect(micErrorMessage('Weird')).toMatch(/Upload a file/);
	});
});

describe('latestOnly', () => {
	it('only the newest token stays current', () => {
		const next = latestOnly();
		const first = next();
		const second = next();
		expect(first()).toBe(false);
		expect(second()).toBe(true);
	});
});

describe('bench state', () => {
	it('walks load → examine → result', () => {
		let s = step(initialBench, { type: 'load' });
		expect(s.kind).toBe('loading');
		s = step(s, { type: 'progress', value: 0.5 });
		expect(s).toMatchObject({ kind: 'loading', progress: 0.5 });
		s = step(s, { type: 'examine' });
		s = step(s, { type: 'done', predictions: preds, threshold: 0.6 });
		expect(s).toMatchObject({ kind: 'result', unsure: false });
		expect(lastResult(s)?.[0].label).toBe('a');
	});
	it('an error keeps the previous result', () => {
		const done = step(initialBench, { type: 'done', predictions: preds, threshold: 0.9 });
		expect(done).toMatchObject({ kind: 'result', unsure: true });
		const err = step(done, { type: 'fail', reason: 'nope' });
		expect(err).toMatchObject({ kind: 'error', reason: 'nope' });
		expect(lastResult(err)?.[0].label).toBe('a');
	});
});

describe('transcript segments', () => {
	it('splits flagged spans and clamps bad ranges', () => {
		expect(segments('abcdef', [[2, 4]])).toEqual([
			{ text: 'ab', flagged: false }, { text: 'cd', flagged: true }, { text: 'ef', flagged: false }
		]);
		expect(segments('abc', [[2, 99]])).toEqual([{ text: 'ab', flagged: false }, { text: 'c', flagged: true }]);
		expect(segments('abc')).toEqual([{ text: 'abc', flagged: false }]);
	});
});

describe('waveform peaks', () => {
	it('normalises to 0–1 with the requested count', () => {
		const out = peaks(new Float32Array([0, 0.5, -1, 0.25]), 2);
		expect(out).toEqual([0.5, 1]);
	});
});
