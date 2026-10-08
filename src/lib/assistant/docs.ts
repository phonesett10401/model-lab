export type Access = 'public' | 'staff';
export interface Doc { id: string; title: string; access: Access; body: string }
export interface Passage { id: string; docId: string; title: string; access: Access; text: string }

export const PASSAGE_CHARS = 600;

/** A document file: "key: value" header lines, a blank line, then the text. */
export function parseDoc(id: string, raw: string): Doc {
	const text = raw.replace(/\r\n/g, '\n');
	const end = text.indexOf('\n\n');
	if (end < 0) throw new Error(`${id}: header must end with a blank line`);
	const head: Record<string, string> = {};
	for (const line of text.slice(0, end).split('\n')) {
		const i = line.indexOf(':');
		if (i < 0) throw new Error(`${id}: header lines are "key: value"`);
		head[line.slice(0, i).trim()] = line.slice(i + 1).trim();
	}
	if (!head.title) throw new Error(`${id}: missing title`);
	if (head.access !== 'public' && head.access !== 'staff') throw new Error(`${id}: access must be public or staff`);
	return { id, title: head.title, access: head.access, body: text.slice(end + 2).trim() };
}

/** Paragraphs packed into passages of up to PASSAGE_CHARS (a longer paragraph stays whole). */
export function chunk(doc: Doc): Passage[] {
	const out: string[] = [];
	for (const p of doc.body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)) {
		const last = out.length - 1;
		if (last >= 0 && out[last].length + 2 + p.length <= PASSAGE_CHARS) out[last] += '\n\n' + p;
		else out.push(p);
	}
	return out.map((text, i) => ({ id: `${doc.id}#${i + 1}`, docId: doc.id, title: doc.title, access: doc.access, text }));
}

// Bundled at build time; the folder is the single source of the university's documents.
const files = import.meta.glob('/assistant/docs/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const docs: Doc[] = Object.entries(files)
	.map(([path, raw]) => parseDoc(path.split('/').pop()!.replace(/\.md$/, ''), raw))
	.sort((a, b) => a.id.localeCompare(b.id));

export const passages: Passage[] = docs.flatMap(chunk);
