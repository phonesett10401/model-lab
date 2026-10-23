import { assistants } from './assistants';
import type { AuditEntry, MetricRow, Transcript } from '$lib/types';

// One audit per assistant, built by eval/audit-data.mjs from the runner's results; listed only on its assistant, not in the archive.
const files = import.meta.glob<{ status: string; data: AuditEntry['report']['data']; metrics: { title: string; lowerIsBetter?: boolean; rows: MetricRow[] }; transcripts: Transcript[] }>(
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
		report: { data: d.data, metrics: d.metrics, failures: [] }
	}];
});

export const auditFor = (slug: string) => assistantAudits.find((e) => e.slug === slug);
