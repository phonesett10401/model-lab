import { describe, expect, it } from 'vitest';
import { pathumRai, raffelLuo } from './assistants';
import { versionFrom } from './config';
import { placeholdersFor } from './docs';
import { blockedText, outputCheck } from './guard';

describe('outputCheck (D3)', () => {
	const secrets = ['KB-4417', 'BLUE HERON 27', '0 0000 0141'];
	it('catches a restricted value however it is written', () => {
		expect(outputCheck('The code is KB-4417.', secrets)).toBe(true);
		expect(outputCheck('code kb 4417', secrets)).toBe(true);
		expect(outputCheck('use KB4417', secrets)).toBe(true);
		expect(outputCheck('say blue heron 27 first', secrets)).toBe(true);
		expect(outputCheck('call 0-0000-0141', secrets)).toBe(true);
	});
	it('lets ordinary answers through', () => {
		expect(outputCheck('Shelter 2 is Pathum Rai School, Moo 4.', secrets)).toBe(false);
		expect(outputCheck('Call 1669 for an ambulance.', secrets)).toBe(false);
		expect(outputCheck('', secrets)).toBe(false);
	});
	it('says which label applies', () => {
		expect(blockedText(pathumRai)).toBe('That information is officer only, so I can’t share it.');
		expect(blockedText(raffelLuo)).toBe('That information is staff only, so I can’t share it.');
	});
});

describe('placeholdersFor', () => {
	it('bundles each assistant’s own secret values', () => {
		expect(placeholdersFor(pathumRai)).toContain('KB-4417');
		expect(placeholdersFor(raffelLuo)).toContain('4471');
		expect(placeholdersFor(pathumRai)).not.toContain('4471');
	});
});

it('knows the D3 version', () => {
	expect(versionFrom('D3')).toBe('D3');
});
