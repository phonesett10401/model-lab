<script lang="ts">
	import Bar from './Bar.svelte';
	import Rule from './Rule.svelte';
	import { sortMetrics } from '$lib/predictions';
	import { pct } from '$lib/format';
	import type { ReportCard } from '$lib/types';

	type Section = 'data' | 'metrics' | 'fails';
	let {
		report, show, idPrefix, tabbed = false, onpick
	}: { report: ReportCard; show: Section[]; idPrefix: string; tabbed?: boolean; onpick?: (sampleId: string) => void } = $props();

	const rows = $derived(sortMetrics(report.metrics.rows, report.metrics.lowerIsBetter));
	const role = $derived(tabbed ? 'tabpanel' : undefined);
</script>

<div class="report">
	<section id="{idPrefix}-data" {role} aria-labelledby="{idPrefix}-data-h" hidden={!show.includes('data')}>
		<h3 id="{idPrefix}-data-h" class="mono">DATA</h3>
		<Rule />
		<dl>
			{#each report.data as d (d.label)}
				<div><dt class="soft">{d.label}</dt><dd class={d.value === null ? 'mono faint' : ''}>{d.value ?? 'not yet measured'}</dd></div>
			{/each}
		</dl>
	</section>

	<section id="{idPrefix}-metrics" {role} aria-labelledby="{idPrefix}-metrics-h" hidden={!show.includes('metrics')}>
		<h3 id="{idPrefix}-metrics-h" class="mono">{report.metrics.title.toUpperCase()}</h3>
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
		<h3 id="{idPrefix}-fails-h" class="mono">HOW IT FAILS</h3>
		<Rule />
		{#if report.failures.length === 0}
			<p class="mono faint">not yet measured</p>
		{:else}
			<ul class="fails">
				{#each report.failures as f, i (i)}
					<li>
						<p class="mono">true: {f.truth}</p>
						<p class="mono said">said: {f.said} · {pct(f.score)}%</p>
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
	h3 { color: var(--red); font-weight: 500; letter-spacing: 0.12em; }
	dl { margin: 0; display: grid; }
	dl div { display: flex; justify-content: space-between; gap: var(--space-2); padding: 0.4rem 0; border-bottom: 1px solid var(--hairline); }
	dd { margin: 0; text-align: right; }
	.bars { display: grid; gap: 0.55rem; margin: 0; padding: 0; }
	.fails { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
	.fails li { background: var(--plate); border: 1px solid var(--hairline); padding: var(--space-2); display: grid; gap: 0.3rem; justify-items: start; }
	.said { color: var(--red); }
</style>
