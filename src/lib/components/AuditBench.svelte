<script lang="ts">
	import EntryHeader from './EntryHeader.svelte';
	import ReportCard from './ReportCard.svelte';
	import type { AuditEntry } from '$lib/types';

	let { entry }: { entry: AuditEntry } = $props();
</script>

<article class="bench">
	<EntryHeader {entry} level={2} link />
	{#if entry.status !== 'published'}<p class="mono faint">Write-up in progress. Results appear once measured.</p>{/if}
	<p class="summary">{entry.summary}</p>
	<ReportCard report={entry.report} show={['data', 'metrics', 'fails']} idPrefix="bench-{entry.slug}" />
</article>

<style>
	.bench { display: grid; gap: var(--space-3); min-width: 0; }
	.summary { max-width: 65ch; }
</style>
