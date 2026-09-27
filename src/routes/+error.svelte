<script lang="ts">
	import { page } from '$app/state';
	import Stamp from '$lib/components/Stamp.svelte';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? 'Not found' : 'Error'} · Specimen Archive</title></svelte:head>

<article class="err">
	<p class="mono faint">No. {page.status} <Stamp status="missing" /></p>
	<h1 class="serif">{notFound ? 'Specimen not found.' : 'Something broke.'}</h1>
	<p class="soft">{notFound ? 'This page isn’t in the archive. It may have moved, or the link has a typo.' : page.error?.message}</p>
	<a class="btn" href="/">Back to the archive</a>
</article>

<style>
	.err { max-width: 40rem; margin: 0 auto; padding: var(--space-6) var(--gutter); display: grid; gap: var(--space-2); justify-items: start; }
	h1 { font-size: var(--step-4); }
	p:first-child { display: flex; gap: 0.6rem; align-items: center; }
</style>
