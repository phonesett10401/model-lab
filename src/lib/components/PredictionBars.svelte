<script lang="ts">
	import Bar from './Bar.svelte';
	import type { Prediction } from '$lib/types';

	let { predictions }: { predictions: Prediction[] } = $props();
</script>

<ol class="bars" aria-label="Prediction">
	{#each predictions as p, i (p.label)}
		<Bar label={p.label} score={p.score} top={i === 0} />
	{/each}
</ol>

<style>
	.bars { display: grid; gap: 0.45rem; margin: 0; padding: 0; }
</style>
