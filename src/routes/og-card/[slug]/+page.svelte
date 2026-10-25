<script lang="ts">
	import Stamp from '$lib/components/Stamp.svelte';
	import { assistants } from '$lib/assistant/assistants';
	import { auditFor } from '$lib/assistant/audits';
	import { kindLabel, pad, pct } from '$lib/format';

	let { data } = $props();

	// The assistants card shows each audit's measured leak rate, no defence (v0) against the recommended version (v1).
	const rate = (rows: { label: string; value: number | null }[], v: string) => rows.find((r) => r.label === v)?.value;
	const leaks = assistants.flatMap((a) => {
		const rows = auditFor(a.slug)?.report.metrics.rows ?? [];
		const [v0, v1] = [rate(rows, 'v0'), rate(rows, 'v1')];
		return typeof v0 === 'number' && typeof v1 === 'number' ? [{ a, v0, v1 }] : [];
	});
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<div class="card" data-theme="light">
	{#if data.entry}
		<p class="mono kicker">AI Model Lab</p>
		<p class="mono meta"><span>No. {pad(data.entry.no)}</span><span>{kindLabel(data.entry)}</span><Stamp status={data.entry.status} /></p>
		<h1 class="serif">{data.entry.name}</h1>
		<p class="purpose">{data.entry.purpose}</p>
	{:else if data.section === 'assistants'}
		<p class="mono kicker">AI Model Lab, RAG assistants</p>
		<h1 class="serif">Ask it. Attack it. <span class="accent">See what leaks.</span></h1>
		{#if leaks.length}
			<ul class="leaks">
				{#each leaks as l (l.a.slug)}
					<li><span class="mark" style="background: {l.a.accent.light}"></span><span>{l.a.name.replace(/ assistant$/, '')}</span><b class="mono">{pct(l.v0)}% → {pct(l.v1)}%</b></li>
				{/each}
			</ul>
			<p class="mono meta">Attacks that leaked a restricted value, with no defence and with v1</p>
		{/if}
	{:else}
		<p class="mono kicker">AI Model Lab</p>
		<h1 class="serif">Click it. Test it. <span class="accent">See the result.</span></h1>
		<p class="purpose">Small AI models I train, each with a report card that shows how it fails.</p>
	{/if}
</div>

<style>
	.card {
		width: 1200px; height: 630px; padding: 72px 80px; display: grid; align-content: center; gap: 24px;
		background: #f5f3f2; color: #161212; border-bottom: 10px solid #b3261e; color-scheme: light;
	}
	.kicker { color: #b3261e; font-size: 22px; }
	.accent { color: #b3261e; }
	.meta { display: flex; gap: 16px; align-items: center; font-size: 22px; color: #6e6565; }
	h1 { font-size: 104px; line-height: 0.95; max-width: 14ch; }
	.purpose { font-size: 32px; color: #5c5454; max-width: 30ch; }
	.leaks { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 10px; font-size: 32px; }
	.leaks li { display: grid; grid-template-columns: 18px 1fr auto; align-items: center; gap: 18px; max-width: 900px; }
	.mark { width: 18px; height: 18px; }
	.leaks b { font-weight: 500; font-size: 32px; letter-spacing: 0; }
</style>
