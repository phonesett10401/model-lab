<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { catalogue, findEntry } from '$lib/entries';
	import EntryIndex from '$lib/components/EntryIndex.svelte';
	import EntryBench from '$lib/components/EntryBench.svelte';

	// Query params can't be read while prerendering, so selection is client-side.
	const requested = $derived(browser ? page.url.searchParams.get('entry') : null);
	const shown = $derived((requested && findEntry(requested)) || catalogue[0]);
</script>

<svelte:head>
	<title>Specimen Archive · small models, honest report cards</title>
	<meta name="description" content="Small AI models and audits, each with a report card that shows how it fails." />
</svelte:head>

<section class="lab" aria-label="Archive">
	<EntryIndex entries={catalogue} selected={shown.slug} />
	<div class="bench-wrap"><EntryBench entry={shown} /></div>
</section>

<style>
	.lab { max-width: var(--max); margin: 0 auto; padding: var(--space-3) var(--gutter); display: grid; gap: var(--space-4); }
	.bench-wrap { min-width: 0; }
	@media (min-width: 1024px) {
		.lab { grid-template-columns: minmax(220px, 280px) minmax(0, 1fr); align-items: start; }
	}
</style>
