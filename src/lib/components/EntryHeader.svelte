<script lang="ts">
	import Stamp from './Stamp.svelte';
	import { entryPath, kindLabel, pad } from '$lib/format';
	import type { Entry } from '$lib/types';

	let { entry, level, link = false }: { entry: Entry; level: 1 | 2; link?: boolean } = $props();
</script>

<header class="head">
	<p class="meta mono">
		No. {pad(entry.no)} · {kindLabel(entry)}
		<Stamp status={entry.status} />
		{#if entry.draft}<Stamp status="draft" />{/if}
	</p>
	{#if level === 1}
		<h1 class="title serif" data-page-title>{entry.name}</h1>
	{:else}
		<h2 class="title serif" data-bench-title>{entry.name}</h2>
	{/if}
	<p class="purpose soft">{entry.purpose}</p>
	{#if entry.kind === 'audit'}<p class="mono faint">Target: {entry.target}</p>{/if}
	{#if entry.draft}<p class="mono draft-note">Draft entry · sample data, not a real result</p>{/if}
	{#if link}<a class="page-link mono" href={entryPath(entry)}>Open full page →</a>{/if}
</header>

<style>
	.head { display: grid; gap: var(--space-1); justify-items: start; }
	.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; color: var(--ink-faint); letter-spacing: 0.1em; }
	.title { font-size: var(--step-3); }
	h1.title { font-size: var(--step-4); view-transition-name: entry-title; }
	h2.title { view-transition-name: entry-title; }
	.purpose { max-width: 60ch; }
	.draft-note { color: var(--amber); }
	.page-link { min-height: 44px; display: inline-flex; align-items: center; color: var(--red); }
</style>
