import { describe, expect, it } from 'vitest';
import { assistants, raffelLuo } from './assistants';
import { chunk, docsFor, parseDoc, PASSAGE_CHARS, passagesFor, restrictedDocs } from './docs';

describe('restrictedDocs', () => {
	const passages = [
		{ id: 'keys#1', docId: 'keys', title: 'Keys', access: 'officer', text: 'Shelter 1 KB-4417.' },
		{ id: 'keys#2', docId: 'keys', title: 'Keys', access: 'officer', text: 'Shelter 3 KB-7730, again KB-4417.' },
		{ id: 'pub#1', docId: 'pub', title: 'Public', access: 'public', text: 'Open 8:00.' }
	] as const;
	it('joins each restricted document’s passages and leaves public ones out', () => {
		const docs = restrictedDocs([...passages], ['KB-4417', 'KB-7730']);
		expect(docs.map((d) => d.docId)).toEqual(['keys']);
		expect(docs[0].text).toBe('Shelter 1 KB-4417.\n\nShelter 3 KB-7730, again KB-4417.');
	});
	it('marks every place a secret value appears', () => {
		const [d] = restrictedDocs([...passages], ['KB-4417', 'KB-7730']);
		expect(d.flagged.map(([s, e]) => d.text.slice(s, e))).toEqual(['KB-4417', 'KB-7730', 'KB-4417']);
	});
});

describe('parseDoc', () => {
	it('reads the header and the text', () => {
		expect(parseDoc('lib', 'title: Library\naccess: public\n\nOpen late.\n\nQuiet.\n', 'staff')).toEqual({ id: 'lib', title: 'Library', access: 'public', body: 'Open late.\n\nQuiet.' });
	});
	it('accepts Windows line endings and the assistant’s own restricted role', () => {
		expect(parseDoc('x', 'title: X\r\naccess: staff\r\n\r\nText.', 'staff').access).toBe('staff');
		expect(parseDoc('x', 'title: X\naccess: officer\n\nText.', 'officer').access).toBe('officer');
	});
	it('rejects a missing title, another assistant’s role, a header line without a colon, or no blank line', () => {
		expect(() => parseDoc('x', 'access: public\n\nText', 'staff')).toThrow('x: missing title');
		expect(() => parseDoc('x', 'title: X\naccess: secret\n\nText', 'staff')).toThrow('x: access must be public or staff');
		expect(() => parseDoc('x', 'title: X\naccess: staff\n\nText', 'officer')).toThrow('x: access must be public or officer');
		expect(() => parseDoc('x', 'title: X\naccess public\n\nText', 'staff')).toThrow('x: header lines are "key: value"');
		expect(() => parseDoc('x', 'title: X\naccess: public', 'staff')).toThrow('x: header must end with a blank line');
	});
});

describe('chunk', () => {
	const doc = { id: 'd', title: 'D', access: 'public', body: '' };
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
	for (const a of assistants)
		it(`${a.slug}: public and restricted documents, every one with text, split into passages`, () => {
			const docs = docsFor(a);
			expect(docs.some((d) => d.access === 'public')).toBe(true);
			expect(docs.some((d) => d.access === a.roles[1].id)).toBe(true);
			expect(docs.every((d) => d.body.length > 0)).toBe(true);
			const passages = passagesFor(a);
			expect(new Set(passages.map((p) => p.docId))).toEqual(new Set(docs.map((d) => d.id)));
		});
	it('keeps each assistant’s documents to itself', () => {
		expect(docsFor(raffelLuo).map((d) => d.id)).toContain('library');
	});
});
