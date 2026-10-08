import { describe, expect, it } from 'vitest';
import { chunk, docs, parseDoc, PASSAGE_CHARS, passages } from './docs';

describe('parseDoc', () => {
	it('reads the header and the text', () => {
		expect(parseDoc('lib', 'title: Library\naccess: public\n\nOpen late.\n\nQuiet.\n')).toEqual({ id: 'lib', title: 'Library', access: 'public', body: 'Open late.\n\nQuiet.' });
	});
	it('accepts Windows line endings', () => {
		expect(parseDoc('x', 'title: X\r\naccess: staff\r\n\r\nText.').access).toBe('staff');
	});
	it('rejects a missing title, a bad access level, a header line without a colon, or no blank line', () => {
		expect(() => parseDoc('x', 'access: public\n\nText')).toThrow('x: missing title');
		expect(() => parseDoc('x', 'title: X\naccess: secret\n\nText')).toThrow('x: access must be public or staff');
		expect(() => parseDoc('x', 'title: X\naccess public\n\nText')).toThrow('x: header lines are "key: value"');
		expect(() => parseDoc('x', 'title: X\naccess: public')).toThrow('x: header must end with a blank line');
	});
});

describe('chunk', () => {
	const doc = { id: 'd', title: 'D', access: 'public' as const, body: '' };
	it('packs paragraphs into passages up to the limit', () => {
		const a = 'a'.repeat(300), b = 'b'.repeat(250), c = 'c'.repeat(100);
		const out = chunk({ ...doc, body: `${a}\n\n${b}\n\n${c}` });
		expect(out.map((p) => p.text)).toEqual([`${a}\n\n${b}`, c]);
		expect(out.map((p) => p.id)).toEqual(['d#1', 'd#2']);
		expect(out[0]).toMatchObject({ docId: 'd', title: 'D', access: 'public' });
	});
	it('keeps an over-long paragraph whole', () => {
		const long = 'x'.repeat(PASSAGE_CHARS + 50);
		expect(chunk({ ...doc, body: long }).map((p) => p.text)).toEqual([long]);
	});
});

describe('the bundled documents', () => {
	it('include public and staff documents, every one with text', () => {
		expect(docs.some((d) => d.access === 'public')).toBe(true);
		expect(docs.some((d) => d.access === 'staff')).toBe(true);
		expect(docs.every((d) => d.body.length > 0)).toBe(true);
		expect(docs.map((d) => d.id)).toContain('library');
	});
	it('split into passages that carry their document id', () => {
		expect(passages.length).toBeGreaterThanOrEqual(docs.length);
		expect(new Set(passages.map((p) => p.docId))).toEqual(new Set(docs.map((d) => d.id)));
	});
});
