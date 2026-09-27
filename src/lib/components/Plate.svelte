<script lang="ts">
	import Stamp from './Stamp.svelte';
	import { kindLabel, pad } from '$lib/format';
	import type { Entry } from '$lib/types';

	let { entry, selected = false }: { entry: Entry; selected?: boolean } = $props();
</script>

<a
	class="plate"
	href="/?entry={entry.slug}"
	data-slug={entry.slug}
	aria-current={selected ? 'true' : undefined}
	data-sveltekit-noscroll
	data-sveltekit-keepfocus
>
	<span class="meta mono">No. {pad(entry.no)} · {kindLabel(entry)}</span>
	<span class="name serif" data-plate-title={entry.slug}>{entry.name}</span>
	<span class="stamps">
		<Stamp status={entry.status} />
		{#if entry.draft}<Stamp status="draft" />{/if}
	</span>
</a>

<style>
	.plate {
		display: grid; gap: 0.3rem; min-height: 44px; padding: var(--space-2);
		background: var(--plate); border: 1px solid var(--hairline); text-decoration: none;
		transition: box-shadow 0.2s, border-color 0.2s;
	}
	.plate:hover { border-color: var(--ink-faint); }
	.plate[aria-current='true'] { box-shadow: inset 3px 0 var(--red); border-color: var(--ink-faint); }
	.meta { color: var(--ink-faint); letter-spacing: 0.1em; }
	.name { font-size: var(--step-1); line-height: 1.1; }
	.stamps { display: flex; gap: 0.5rem; flex-wrap: wrap; }
</style>
