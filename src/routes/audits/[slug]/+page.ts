import { error } from '@sveltejs/kit';
import { catalogue, findEntry } from '$lib/entries';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => catalogue.filter((e) => e.kind === 'audit').map((e) => ({ slug: e.slug }));

export const load: PageLoad = ({ params }) => {
	const entry = findEntry(params.slug);
	if (!entry || entry.kind !== 'audit') error(404, 'No such audit');
	return { entry };
};
