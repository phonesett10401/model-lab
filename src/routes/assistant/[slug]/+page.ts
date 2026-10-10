import { error } from '@sveltejs/kit';
import { assistants, findAssistant } from '$lib/assistant/assistants';
import { passagesFor, placeholdersFor } from '$lib/assistant/docs';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => assistants.map((a) => ({ slug: a.slug }));

export const load: PageLoad = ({ params }) => {
	const a = findAssistant(params.slug);
	if (!a) error(404, 'No such assistant');
	return { slug: a.slug, passages: passagesFor(a), secrets: placeholdersFor(a) };
};
