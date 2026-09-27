<script lang="ts">
	import { Spring } from 'svelte/motion';
	import { reducedMotion } from '$lib/motion.svelte';
	import { pct, shownPct } from '$lib/format';

	let { label, score, before, top = false }: { label: string; score: number | null; before?: number | null; top?: boolean } = $props();

	const s = new Spring(0, { stiffness: 0.12, damping: 0.38 });
	$effect(() => {
		s.set(score ?? 0, { instant: reducedMotion.current });
	});

	const spoken = $derived(
		score === null
			? `${label}, not yet measured`
			: `${label}, ${pct(score)} percent${typeof before === 'number' ? `, ${pct(before)} percent before defences` : ''}`
	);
</script>

<li class="bar" class:top aria-label={spoken}>
	<span class="label mono" aria-hidden="true">{label}</span>
	<span class="track" aria-hidden="true">
		{#if typeof before === 'number'}<span class="before" style="transform: scaleX({before})"></span>{/if}
		<span class="fill" style="transform: scaleX({s.current})"></span>
	</span>
	<span class="value mono" aria-hidden="true">{score === null ? '—' : `${shownPct(s.current, score)}%`}</span>
</li>

<style>
	.bar { display: grid; grid-template-columns: minmax(5.5rem, 34%) 1fr 3.2rem; align-items: center; gap: var(--space-1); list-style: none; }
	.label { color: var(--ink-soft); overflow-wrap: anywhere; }
	.top .label { color: var(--ink); }
	.track { position: relative; height: 7px; background: color-mix(in srgb, var(--ink) 10%, transparent); border-radius: 4px; overflow: hidden; }
	.fill, .before { position: absolute; inset: 0; transform-origin: left; border-radius: 4px; }
	.fill { background: var(--red); }
	.bar:not(.top) .fill { opacity: 0.5; }
	.before { background: color-mix(in srgb, var(--ink) 25%, transparent); }
	.value { text-align: right; font-variant-numeric: tabular-nums; }
</style>
