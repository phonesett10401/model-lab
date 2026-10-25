<script lang="ts">
	import Bar from './Bar.svelte';
	import Rule from './Rule.svelte';
	import { sortMetrics } from '$lib/predictions';
	import { pct } from '$lib/format';
	import type { ReportCard } from '$lib/types';

	type Section = 'data' | 'metrics' | 'fails';
	let {
		report, show, idPrefix, tabbed = false, onpick, level = 3
	}: { report: ReportCard; show: Section[]; idPrefix: string; tabbed?: boolean; onpick?: (sampleId: string) => void; level?: 2 | 3 } = $props();
	// Section headings sit one level under the entry's title: h2 on a page (title is h1), h3 on the home bench (title is h2).
	const h = $derived(`h${level}`);

	const rows = $derived(sortMetrics(report.metrics.rows, report.metrics.lowerIsBetter));
	const role = $derived(tabbed ? 'tabpanel' : undefined);
</script>

<div class="report">
	<section id="{idPrefix}-data" {role} aria-labelledby="{idPrefix}-data-h" hidden={!show.includes('data')}>
		<svelte:element this={h} id="{idPrefix}-data-h" class="h">Data</svelte:element>
		<Rule />
		<dl>
			{#each report.data as d (d.label)}
				<div><dt class="soft">{d.label}</dt><dd class={d.value === null ? 'mono faint' : ''}>{d.value ?? 'not yet measured'}</dd></div>
			{/each}
		</dl>
	</section>

	<section id="{idPrefix}-metrics" {role} aria-labelledby="{idPrefix}-metrics-h" hidden={!show.includes('metrics')}>
		<svelte:element this={h} id="{idPrefix}-metrics-h" class="h">{report.metrics.title}</svelte:element>
		<Rule />
		<ol class="bars">
			{#each rows as r (r.label)}
				<Bar label={r.label} score={r.value} before={r.before} top />
			{/each}
		</ol>
		<p class="mono faint note">
			{report.metrics.lowerIsBetter ? 'Lower is better.' : 'Worst category first.'}
			{rows.some((r) => r.before !== undefined) ? 'Grey shows before defences.' : ''}
			{rows.every((r) => r.value === null) ? 'Values appear once measured on held-out test data.' : ''}
		</p>
	</section>

	<section id="{idPrefix}-fails" {role} aria-labelledby="{idPrefix}-fails-h" hidden={!show.includes('fails')}>
		<svelte:element this={h} id="{idPrefix}-fails-h" class="h">How it fails</svelte:element>
		<Rule />
		{#if report.failures.length === 0}
			<p class="mono faint">not yet measured</p>
		{:else}
			<ul class="fails">
				{#each report.failures as f, i (i)}
					<li>
						<p class="mono">true: {f.truth}</p>
						<p class="mono said">said: {f.said}{f.score > 0 ? `, ${pct(f.score)}%` : ''}</p>
						<p class="soft">{f.why}</p>
						{#if onpick && f.sampleId}
							<button class="btn ghost" onclick={() => onpick(f.sampleId!)}>Try this one</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.report { display: grid; gap: var(--space-4); }
	section { display: grid; gap: var(--space-2); align-content: start; }
	section[hidden] { display: none; }
	.h { font-family: var(--font-serif); font-size: var(--step-2); }
	dl { margin: 0; display: grid; }
	dl div { display: flex; justify-content: space-between; gap: var(--space-2); padding: 0.4rem 0; border-bottom: 1px solid var(--hairline); }
	dt { flex-shrink: 0; max-width: 45%; }
	dd { margin: 0; text-align: right; }
	.bars { display: grid; gap: 0.55rem; margin: 0; padding: 0; }
	.fails { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
	.fails li { background: var(--plate); border: 1px solid var(--hairline); padding: var(--space-2); display: grid; gap: 0.3rem; justify-items: start; }
	.said { color: var(--red); }
</style>
