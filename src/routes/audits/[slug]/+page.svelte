<script lang="ts">
	import EntryHeader from '$lib/components/EntryHeader.svelte';
	import EntryMeta from '$lib/components/EntryMeta.svelte';
	import ReportCard from '$lib/components/ReportCard.svelte';
	import TranscriptViewer from '$lib/components/TranscriptViewer.svelte';

	let { data } = $props();
</script>

<EntryMeta entry={data.entry} />
<article class="page">
	<a class="back mono" href="/?entry={data.entry.slug}#archive">← Archive</a>
	<EntryHeader entry={data.entry} level={1} />
	<p class="summary">{data.entry.summary}</p>
	{#if data.entry.status !== 'published'}<p class="mono faint">Write-up in progress. Results appear once measured.</p>{/if}
	{#if data.entry.transcripts.length}<TranscriptViewer transcripts={data.entry.transcripts} />{/if}
	<ReportCard report={data.entry.report} show={data.entry.transcripts.length && !data.entry.report.failures.length ? ['data', 'metrics'] : ['data', 'metrics', 'fails']} idPrefix="page" />
</article>

<style>
	.page { max-width: var(--max); margin: 0 auto; padding: var(--space-3) var(--gutter); display: grid; gap: var(--space-4); }
	.summary { max-width: 65ch; font-size: var(--step-1); }
	.back { min-height: 44px; display: inline-flex; align-items: center; justify-self: start; }
</style>
