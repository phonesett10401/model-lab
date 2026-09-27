<script lang="ts">
	import Stamp from '$lib/components/Stamp.svelte';
	import { kindLabel, pad } from '$lib/format';

	let { data } = $props();
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<div class="card" data-theme="light">
	<p class="mono kicker">SPECIMEN ARCHIVE · VOL. 01</p>
	{#if data.entry}
		<p class="mono meta">No. {pad(data.entry.no)} · {kindLabel(data.entry)} <Stamp status={data.entry.status} /></p>
		<h1 class="serif">{data.entry.name}</h1>
		<p class="purpose">{data.entry.purpose}</p>
	{:else}
		<h1 class="serif">See what it sees. <em>And where it’s wrong.</em></h1>
		<p class="purpose">Small AI models and audits, each with a report card that shows how it fails.</p>
	{/if}
</div>

<style>
	.card {
		width: 1200px; height: 630px; padding: 72px 80px; display: grid; align-content: center; gap: 24px;
		background: #f5f3f2; color: #161212; border-bottom: 10px solid #b3261e; color-scheme: light;
	}
	.kicker { color: #b3261e; letter-spacing: 0.14em; font-size: 22px; }
	.meta { display: flex; gap: 16px; align-items: center; font-size: 22px; color: #6e6565; }
	h1 { font-size: 104px; line-height: 0.95; }
	h1 em { color: #b3261e; }
	.purpose { font-size: 32px; color: #5c5454; max-width: 30ch; }
</style>
