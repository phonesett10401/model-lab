import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Like the audits, the assistant (a red-teaming target) is left out of the production build.
// The ternary (not an if) lets the build drop the documents entirely when __SHOW_DRAFTS__ is false.
export const prerender = __SHOW_DRAFTS__;

export const load: PageLoad = async () =>
	__SHOW_DRAFTS__ ? { passages: (await import('$lib/assistant/docs')).passages } : error(404, 'Not found');
