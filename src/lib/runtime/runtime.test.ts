import { describe, expect, it } from 'vitest';
import { getRuntime, registry } from './index';
import { spread } from './demo';
import { allEntries } from '../entries';
import type { ModelEntry } from '../types';

const models = allEntries.filter((e): e is ModelEntry => e.kind === 'model');

describe('runtime slot', () => {
	it('every live, non-draft model has a registered runtime', () => {
		const missing = models.filter((m) => m.status === 'live' && !m.draft && !registry[m.slug]).map((m) => m.slug);
		expect(missing).toEqual([]);
	});

	it('non-live models have no runtime', async () => {
		expect(await getRuntime(models.find((m) => m.slug === 'fresh-or-spoiled')!)).toBeNull();
	});

	it('drafts get the demo runtime, which replays sample outputs', async () => {
		const shapes = models.find((m) => m.slug === 'draft-shape-sorter')!;
		const rt = await getRuntime(shapes);
		expect(rt).not.toBeNull();
		const out = await rt!.classify({ type: 'text', text: '', sampleId: 'star' });
		expect(out[0]).toEqual({ label: 'triangle', score: 0.52 });
	});
});

describe('spread', () => {
	it('is deterministic and sums to 1', () => {
		const a = spread(['x', 'y', 'z'], 42);
		expect(spread(['x', 'y', 'z'], 42)).toEqual(a);
		expect(a.reduce((s, p) => s + p.score, 0)).toBeCloseTo(1, 6);
	});
});
