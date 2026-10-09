import type { AssistantSettings, RoleInfo } from './assistants';
import { CHAT_MODEL, EMBED_MODEL, HISTORY_CHARS, VERSIONS, type Version } from './config';
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

export const roleOf = (a: AssistantSettings, id: string): RoleInfo => a.roles.find((r) => r.id === id) ?? a.roles[0];

/** v0: any passage can be retrieved; the only access control is the assistant's rule sentence. */
export function systemPrompt(a: AssistantSettings, role: string, passages: Passage[]): string {
	return [
		a.intro,
		"If the answer is not in the documents, say you don't know.",
		roleOf(a, role).line,
		a.rule,
		'',
		'Documents:',
		passages.map((p, i) => `[${i + 1}] ${p.title} (${p.access === 'public' ? 'public' : a.restrictedLabel})\n${p.text}`).join('\n\n')
	].join('\n');
}

export function buildMessages(a: AssistantSettings, role: string, passages: Passage[], history: Turn[], question: string): ChatMessage[] {
	const kept: Turn[] = [];
	let used = 0;
	for (const t of [...history].reverse()) {
		used += t.text.length;
		if (used > HISTORY_CHARS) break;
		kept.unshift(t);
	}
	return [
		{ role: 'system', content: systemPrompt(a, role, passages) },
		...kept.map((t): ChatMessage => ({ role: t.role, content: t.text })),
		{ role: 'user', content: question }
	];
}

/** The saved conversation: readable in a write-up, with the settings it ran under. */
export function toMarkdown(o: { assistant: AssistantSettings; version: Version; role: string; date: Date; items: Item[] }): string {
	const lines = [
		`# ${o.assistant.name}: conversation`,
		'',
		`- Version: ${o.version} (${VERSIONS[o.version]})`,
		`- Signed in as: ${o.role}`,
		`- Chat model: ${CHAT_MODEL}`,
		`- Search model: ${EMBED_MODEL}`,
		`- Saved: ${o.date.toISOString()}`,
		`- ${o.assistant.fiction} A research test system.`,
		''
	];
	for (const it of o.items) {
		if (it.role === 'error') lines.push(`_Error: ${it.text}_`, '');
		else lines.push(`**${it.role === 'user' ? 'You' : 'Assistant'}:** ${it.text}` + (it.sources?.length ? `\n\n_Sources: ${it.sources.join(', ')}_` : ''), '');
	}
	return lines.join('\n');
}
