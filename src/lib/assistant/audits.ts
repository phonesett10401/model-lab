import { assistants } from './assistants';
import { VERSIONS, type Version } from './config';
import type { AuditEntry, MetricRow, Transcript } from '$lib/types';

// What each defence can't fix: the owner-reviewed reading of the results (the numbers themselves come from the runs).
const LIMITS: Record<string, string> = {
	D1: 'It only asks the model to behave. A small model often ignores the instruction.',
	D2: 'A fixed list of English phrases. Attacks that are reworded, in another language or hidden in a pasted email get past it.',
	D3: 'It only catches exact restricted codes. A secret that is a fact rather than a code, like Pathum Rai’s water shortage, gets straight past it, and so would a code reworded, spelled out or encoded.',
	D4: 'The model never sees the restricted documents, so it can’t leak them, but asked anyway it may make up an answer instead.'
};

// One audit per assistant, built by eval/audit-data.mjs from the runner's results; listed only on its assistant, not in the archive.
const files = import.meta.glob<{ status: string; data: AuditEntry['report']['data']; metrics: { title: string; lowerIsBetter?: boolean; rows: MetricRow[] }; transcripts: Transcript[]; defences?: { version: string; result: string }[] }>(
	'../data/audits/*.json', { eager: true, import: 'default' }
);

export const assistantAudits: AuditEntry[] = assistants.flatMap((a) => {
	const d = files[`../data/audits/${a.slug}.json`];
	if (d?.status !== 'published') return [];
	return [{
		kind: 'audit', slug: a.slug, no: a.no, name: `${a.name}: attack results`,
		purpose: `Published prompt-injection attacks replayed against the ${a.name}, with no defence (v0) and with each defence on its own.`,
		status: 'published', target: a.name,
		summary: 'The same held-out attacks from deepset/prompt-injections (typed by the user) and Microsoft BIPIA (hidden in an email the user pastes), replayed with no defence (v0) and with each defence on its own. Every number and conversation comes from the runner’s saved results.',
		transcripts: d.transcripts,
		defences: (d.defences ?? []).map((x) => ({ ...x, how: VERSIONS[x.version as Version], limits: LIMITS[x.version] ?? '' })),
		report: { data: d.data, metrics: d.metrics, failures: [] }
	}];
});

export const auditFor = (slug: string) => assistantAudits.find((e) => e.slug === slug);
