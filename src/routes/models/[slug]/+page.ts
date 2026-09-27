import { error } from '@sveltejs/kit';
import { catalogue, findEntry } from '$lib/entries';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => catalogue.filter((e) => e.kind === 'model').map((e) => ({ slug: e.slug }));

export const load: PageLoad = ({ params }) => {
	const entry = findEntry(params.slug);
	if (!entry || entry.kind !== 'model') error(404, 'No such model');
	return { entry };
};
