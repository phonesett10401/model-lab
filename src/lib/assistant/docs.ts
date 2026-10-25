import type { AssistantSettings } from './assistants';
import { parsePlaceholders } from './score';

/** 'public', or the assistant's restricted role id (e.g. 'staff', 'officer'). */
export type Access = string;
export interface Doc { id: string; title: string; access: Access; body: string }
export interface Passage { id: string; docId: string; title: string; access: Access; text: string }

export const PASSAGE_CHARS = 600;

/** A document file: "key: value" header lines, a blank line, then the text. */
export function parseDoc(id: string, raw: string, restricted: string): Doc {
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
	if (head.access !== 'public' && head.access !== restricted) throw new Error(`${id}: access must be public or ${restricted}`);
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

// Bundled at build time; assistant/<slug>/docs/ is the single source of each assistant's documents.
const files = import.meta.glob('/assistant/*/docs/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export function docsFor(a: AssistantSettings): Doc[] {
	const dir = `/assistant/${a.slug}/docs/`;
	return Object.entries(files)
		.filter(([path]) => path.startsWith(dir))
		.map(([path, raw]) => parseDoc(path.slice(dir.length).replace(/\.md$/, ''), raw, a.roles[1].id))
		.sort((x, y) => x.id.localeCompare(y.id));
}

export const passagesFor = (a: AssistantSettings): Passage[] => docsFor(a).flatMap(chunk);

// D3 needs each assistant's restricted values in the browser (the documents holding them are already bundled).
const secretFiles = import.meta.glob('/assistant/*/placeholders.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const placeholdersFor = (a: AssistantSettings): string[] => parsePlaceholders(secretFiles[`/assistant/${a.slug}/placeholders.txt`] ?? '');

/** Each restricted document in full, with every place a secret value appears, for showing on the assistant page. */
export function restrictedDocs(passages: Passage[], secrets: string[]) {
	const docs = new Map<string, { docId: string; title: string; texts: string[] }>();
	for (const p of passages.filter((p) => p.access !== 'public'))
		(docs.get(p.docId) ?? docs.set(p.docId, { docId: p.docId, title: p.title, texts: [] }).get(p.docId)!).texts.push(p.text);
	return [...docs.values()].map(({ docId, title, texts }) => {
		const text = texts.join('\n\n');
		const flagged: [number, number][] = [];
		for (const s of secrets) for (let i = text.indexOf(s); i >= 0; i = text.indexOf(s, i + s.length)) flagged.push([i, i + s.length]);
		return { docId, title, text, flagged: flagged.sort((a, b) => a[0] - b[0]) };
	});
}
