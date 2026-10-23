<script lang="ts">
	import { page } from '$app/state';
	import type { Entry } from '$lib/types';

	// Assistant audits quote fictional data, so like their assistant they stay out of search and have no preview image.
	let { entry, assistant = false }: { entry: Entry; assistant?: boolean } = $props();
	const title = $derived(`${entry.name} · AI Model Lab`);
	const image = $derived(`${page.url.origin}/og/${entry.slug}.png`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={entry.purpose} />
	<link rel="canonical" href="{page.url.origin}{page.url.pathname}" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={entry.purpose} />
	{#if !assistant}<meta property="og:image" content={image} />
	<meta name="twitter:card" content="summary_large_image" />{/if}
	{#if entry.draft || assistant}<meta name="robots" content="noindex" />{/if}
</svelte:head>
