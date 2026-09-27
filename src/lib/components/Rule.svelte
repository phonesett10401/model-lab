<script lang="ts">
	import { draw } from 'svelte/transition';
	import { reducedMotion } from '$lib/motion.svelte';

	let el: SVGSVGElement;
	let seen = $state(false);
	$effect(() => {
		const io = new IntersectionObserver(([e]) => {
			if (e.isIntersecting) { seen = true; io.disconnect(); }
		});
		io.observe(el);
		return () => io.disconnect();
	});
</script>

<svg bind:this={el} class="rule" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden="true">
	{#if seen}
		<line x1="0" y1="1" x2="100" y2="1" vector-effect="non-scaling-stroke" in:draw={{ duration: reducedMotion.current ? 0 : 700 }} />
	{/if}
</svg>

<style>
	.rule { width: 100%; height: 2px; overflow: visible; }
	line { stroke: var(--ink); stroke-width: 1; }
</style>
