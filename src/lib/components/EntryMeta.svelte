<script lang="ts">
	import { page } from '$app/state';
	import type { Entry } from '$lib/types';

	let { entry }: { entry: Entry } = $props();
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
	<meta property="og:image" content={image} />
	<meta name="twitter:card" content="summary_large_image" />
	{#if entry.draft}<meta name="robots" content="noindex" />{/if}
</svelte:head>
