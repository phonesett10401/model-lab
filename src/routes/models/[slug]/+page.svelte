<script lang="ts">
	import EntryHeader from '$lib/components/EntryHeader.svelte';
	import EntryMeta from '$lib/components/EntryMeta.svelte';
	import Workbench from '$lib/components/Workbench.svelte';

	let { data } = $props();
</script>

<EntryMeta entry={data.entry} />
<article class="page">
	<a class="back mono" href="/?entry={data.entry.slug}#archive">← Archive</a>
	<EntryHeader entry={data.entry} level={1} />
	<Workbench entry={data.entry} header={false} />
</article>

<style>
	.page { max-width: var(--max); margin: 0 auto; padding: var(--space-3) var(--gutter); display: grid; gap: var(--space-4); }
	.back { min-height: 44px; display: inline-flex; align-items: center; justify-self: start; }
</style>
