import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('old links to an assistant forward to the assistants section on the server (no JavaScript needed)', () => {
	const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
	for (const slug of ['raffel-luo', 'pathum-rai'])
		expect(cfg.redirects).toContainEqual({ source: '/', has: [{ type: 'query', key: 'entry', value: slug }], destination: '/assistants', permanent: false });
});

it('the old detector address permanently redirects to the new one', () => {
	const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
	expect(cfg.redirects).toContainEqual({ source: '/models/creature-categorizer', destination: '/models/sea-creature-detector', permanent: true });
});
