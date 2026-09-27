<script lang="ts">
	import EntryHeader from './EntryHeader.svelte';
	import ReportCard from './ReportCard.svelte';
	import type { ModelEntry } from '$lib/types';

	let { entry, header = true }: { entry: ModelEntry; header?: boolean } = $props();
</script>

<article class="bench">
	{#if header}<EntryHeader {entry} level={2} link />{/if}
	<ReportCard report={entry.report} show={['data', 'metrics', 'fails']} idPrefix="bench-{entry.slug}" />
</article>
