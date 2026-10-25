<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { reducedMotion } from '$lib/motion.svelte';
	import { pct, shownPct } from '$lib/format';

	let { label, score, before, top = false }: { label: string; score: number | null; before?: number | null; top?: boolean } = $props();

	// Drawn at its value on the server, so it reads without JavaScript. A bar that starts below the fold drops to 0
	// while still off screen and grows when scrolled to; later score changes (a new result) grow it too.
	const DUR = 420; // --dur-long; ease-out with no overshoot, so the bar never shows more than was measured
	const s = new Tween(untrack(() => score ?? 0), { duration: DUR, easing: cubicOut });
	let seen = $state(true);
	let el: HTMLLIElement;
	$effect(() => {
		if (seen) s.set(score ?? 0, { duration: reducedMotion.current ? 0 : DUR });
	});
	onMount(() => {
		if (reducedMotion.current || typeof IntersectionObserver === 'undefined') return;
		let first = true;
		const io = new IntersectionObserver(([e]) => {
			if (e.isIntersecting) { seen = true; io.disconnect(); }
			else if (first) { seen = false; s.set(0, { duration: 0 }); }
			first = false;
		});
		io.observe(el);
		return () => io.disconnect();
	});

	const spoken = $derived(
		score === null
			? `${label}, not yet measured`
			: `${label}, ${pct(score)} percent${typeof before === 'number' ? `, ${pct(before)} percent before defences` : ''}`
	);
</script>

<li class="bar" class:top aria-label={spoken} bind:this={el}>
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
