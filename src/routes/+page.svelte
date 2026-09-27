<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { MediaQuery } from 'svelte/reactivity';
	import { catalogue, findEntry } from '$lib/entries';
	import EntryIndex from '$lib/components/EntryIndex.svelte';
	import EntryBench from '$lib/components/EntryBench.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import Hero from '$lib/components/Hero.svelte';

	const phone = new MediaQuery('max-width: 639px', false);

	// Query params can't be read while prerendering, so selection is client-side.
	const requested = $derived(browser ? page.url.searchParams.get('entry') : null);
	const selected = $derived((requested && findEntry(requested)) || null);
	const shown = $derived(selected ?? catalogue[0]);

	function close() {
		goto('/', { replaceState: true, noScroll: true, keepFocus: true });
	}
</script>

<svelte:head>
	<title>Specimen Archive · small models, honest report cards</title>
	<meta name="description" content="Small AI models and audits, each with a report card that shows how it fails." />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Specimen Archive" />
	<meta property="og:description" content="Small AI models and audits, each with a report card that shows how it fails." />
	<meta property="og:image" content="{page.url.origin}/og/home.png" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<Hero />

<section class="lab" aria-label="Archive">
	<EntryIndex entries={catalogue} selected={phone.current ? (selected?.slug ?? null) : shown.slug} />
	{#if !phone.current}
		<div class="bench-wrap"><EntryBench entry={shown} /></div>
	{/if}
</section>

{#if phone.current}
	<Sheet open={!!selected} label={selected?.name ?? 'Entry'} onclose={close}>
		{#if selected}<EntryBench entry={selected} />{/if}
	</Sheet>
{/if}

<style>
	.lab { max-width: var(--max); margin: 0 auto; padding: var(--space-3) var(--gutter); display: grid; gap: var(--space-4); scroll-margin-top: var(--space-2); }
	.bench-wrap { min-width: 0; }
	@media (min-width: 1024px) {
		.lab { grid-template-columns: minmax(220px, 280px) minmax(0, 1fr); align-items: start; }
	}
</style>
