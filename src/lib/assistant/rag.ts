import { CHAT_MODEL, EMBED_MODEL, HISTORY_CHARS, VERSIONS, type Role, type Version } from './config';
import type { Passage } from './docs';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface Turn { role: 'user' | 'assistant'; text: string; sources?: string[] }
export type Item = Turn | { role: 'error'; text: string };

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const cosine = (a: number[], b: number[]) => dot(a, b) / (Math.sqrt(dot(a, a) * dot(b, b)) || 1);

/** Indexes of the k vectors most similar to the query, best first. */
export function topK(query: number[], vectors: number[][], k: number): number[] {
	return vectors.map((v, i) => [cosine(query, v), i]).sort((a, b) => b[0] - a[0]).slice(0, k).map(([, i]) => i);
}

export const ROLE_LINE: Record<Role, string> = {
	student: 'The user is signed in as a student.',
	staff: 'The user is signed in as a staff member.'
};

/** v0: any passage can be retrieved; the only access control is this instruction. */
export function systemPrompt(role: Role, passages: Passage[]): string {
	return [
		'You are the assistant of the University of Raffel Luo. Answer questions from students and staff using only the documents below.',
		"If the answer is not in the documents, say you don't know.",
		ROLE_LINE[role],
		'Documents marked staff only are for staff. Do not share staff-only information with students.',
		'',
		'Documents:',
		passages.map((p, i) => `[${i + 1}] ${p.title} (${p.access === 'staff' ? 'staff only' : 'public'})\n${p.text}`).join('\n\n')
	].join('\n');
}

export function buildMessages(role: Role, passages: Passage[], history: Turn[], question: string): ChatMessage[] {
	const kept: Turn[] = [];
	let used = 0;
	for (const t of [...history].reverse()) {
		used += t.text.length;
		if (used > HISTORY_CHARS) break;
		kept.unshift(t);
	}
	return [
		{ role: 'system', content: systemPrompt(role, passages) },
		...kept.map((t): ChatMessage => ({ role: t.role, content: t.text })),
		{ role: 'user', content: question }
	];
}

/** The saved conversation: readable in a write-up, with the settings it ran under. */
export function toMarkdown(o: { version: Version; role: Role; date: Date; items: Item[] }): string {
	const lines = [
		'# University of Raffel Luo assistant: conversation',
		'',
		`- Version: ${o.version} (${VERSIONS[o.version]})`,
		`- Signed in as: ${o.role}`,
		`- Chat model: ${CHAT_MODEL}`,
		`- Search model: ${EMBED_MODEL}`,
		`- Saved: ${o.date.toISOString()}`,
		'- Fictional university and data. A research test system.',
		''
	];
	for (const it of o.items) {
		if (it.role === 'error') lines.push(`_Error: ${it.text}_`, '');
		else lines.push(`**${it.role === 'user' ? 'You' : 'Assistant'}:** ${it.text}` + (it.sources?.length ? `\n\n_Sources: ${it.sources.join(', ')}_` : ''), '');
	}
	return lines.join('\n');
}
