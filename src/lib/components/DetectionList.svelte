<script lang="ts">
	import Bar from './Bar.svelte';
	import type { Prediction } from '$lib/types';

	let { predictions, max = 12 }: { predictions: Prediction[]; max?: number } = $props();
	const shown = $derived(predictions.slice(0, max));
</script>

<!-- Keyed by position: a photo can hold several creatures with the same name. -->
<ol class="dets" aria-label="Found in the photo">
	{#each shown as p, i (i)}
		<li class="det" data-label={p.label} data-score={p.score} data-box={JSON.stringify(p.box ?? [])}>
			<span class="n mono" aria-hidden="true">{i + 1}</span>
			<ol class="one"><Bar label={p.label} score={p.score} top={i === 0} /></ol>
		</li>
	{/each}
</ol>
{#if predictions.length > max}<p class="mono faint">+{predictions.length - max} more</p>{/if}

<style>
	.dets { display: grid; gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
	.det { display: grid; grid-template-columns: 1.6rem 1fr; align-items: center; gap: var(--space-1); }
	.n { color: var(--red); font-variant-numeric: tabular-nums; }
	.one { margin: 0; padding: 0; }
</style>
