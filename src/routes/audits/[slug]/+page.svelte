<script lang="ts">
	import EntryHeader from '$lib/components/EntryHeader.svelte';
	import EntryMeta from '$lib/components/EntryMeta.svelte';
	import ReportCard from '$lib/components/ReportCard.svelte';
	import TranscriptViewer from '$lib/components/TranscriptViewer.svelte';

	let { data } = $props();
</script>

<EntryMeta entry={data.entry} assistant={data.assistant} />
<article class="page">
	{#if data.assistant}<a class="back mono" href="/assistant/{data.entry.slug}">← {data.entry.target}</a>
	{:else}<a class="back mono" href="/?entry={data.entry.slug}#archive">← Archive</a>{/if}
	<EntryHeader entry={data.entry} level={1} />
	<p class="summary">{data.entry.summary}</p>
	{#if data.entry.status !== 'published'}<p class="mono faint">Write-up in progress. Results appear once measured.</p>{/if}
	{#if data.entry.defences?.length}
		<section class="defences" aria-labelledby="defences-h">
			<h2 id="defences-h" class="mono">How each defence works</h2>
			{#each data.entry.defences as d (d.version)}
				<article>
					<h3 class="serif">{d.version}</h3>
					<dl>
						<div><dt class="mono faint">What it changes</dt><dd>{d.how}</dd></div>
						<div><dt class="mono faint">What it did here</dt><dd>{d.result}</dd></div>
						<div><dt class="mono faint">What it can’t fix</dt><dd>{d.limits}</dd></div>
					</dl>
				</article>
			{/each}
		</section>
	{/if}
	{#if data.entry.transcripts.length}<TranscriptViewer transcripts={data.entry.transcripts} />{/if}
	<ReportCard report={data.entry.report} show={data.entry.transcripts.length && !data.entry.report.failures.length ? ['data', 'metrics'] : ['data', 'metrics', 'fails']} idPrefix="page" level={2} />
</article>

<style>
	.page { max-width: var(--max); margin: 0 auto; padding: var(--space-3) var(--gutter); display: grid; gap: var(--space-4); }
	.summary { max-width: 65ch; font-size: var(--step-1); }
	.back { min-height: 44px; display: inline-flex; align-items: center; justify-self: start; }
	.defences { display: grid; gap: var(--space-2); }
	.defences h2 { font-size: var(--step--1); color: var(--red); letter-spacing: 0.1em; text-transform: uppercase; }
	.defences article { display: grid; gap: var(--space-1); padding: var(--space-2); border: 1px solid var(--hairline); background: var(--plate); }
	.defences h3 { font-size: var(--step-1); }
	.defences dl { margin: 0; display: grid; gap: var(--space-1); }
	.defences div { display: grid; grid-template-columns: 16ch minmax(0, 1fr); gap: var(--space-2); }
	.defences dt { text-transform: uppercase; letter-spacing: 0.08em; font-size: var(--step--1); }
	.defences dd { margin: 0; max-width: 65ch; }
	@media (max-width: 40rem) { .defences div { grid-template-columns: 1fr; gap: 0.2rem; } }
</style>
