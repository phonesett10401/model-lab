import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { allEntries } from './entries';

it('every public entry (and home) has a link-preview image — run `pnpm og` if this fails', () => {
	const missing = ['home', ...allEntries.filter((e) => !e.draft).map((e) => e.slug)].filter((s) => !existsSync(`static/og/${s}.png`));
	expect(missing).toEqual([]);
});
