import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('the old detector address permanently redirects to the new one', () => {
	const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
	expect(cfg.redirects).toContainEqual({ source: '/models/creature-categorizer', destination: '/models/sea-creature-detector', permanent: true });
});
