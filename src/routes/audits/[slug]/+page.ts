import { error } from '@sveltejs/kit';
import { catalogue, findEntry } from '$lib/entries';
import { assistantAudits, auditFor } from '$lib/assistant/audits';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => [...catalogue.filter((e) => e.kind === 'audit'), ...assistantAudits].map((e) => ({ slug: e.slug }));

export const load: PageLoad = ({ params }) => {
	const assistant = auditFor(params.slug);
	const entry = assistant ?? findEntry(params.slug);
	if (!entry || entry.kind !== 'audit') error(404, 'No such audit');
	return { entry, assistant: !!assistant };
};
