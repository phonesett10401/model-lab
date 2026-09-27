import { error } from '@sveltejs/kit';
import { catalogue, findEntry } from '$lib/entries';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => [{ slug: 'home' }, ...catalogue.map((e) => ({ slug: e.slug }))];

export const load: PageLoad = ({ params }) => {
	if (params.slug === 'home') return { entry: null };
	const entry = findEntry(params.slug);
	if (!entry) error(404, 'No such entry');
	return { entry };
};
