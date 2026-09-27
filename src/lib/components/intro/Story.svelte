<script lang="ts">
	import StoryVisual from './StoryVisual.svelte';
	import { storySteps } from '$lib/intro-story';

	let { el = $bindable() }: { el?: HTMLElement } = $props();
	let active = $state(0);
	let items: HTMLElement[] = [];

	$effect(() => {
		// The step crossing the middle of the screen is the active one.
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) if (e.isIntersecting) active = Number((e.target as HTMLElement).dataset.i);
			},
			{ rootMargin: '-45% 0px -45% 0px' }
		);
		items.forEach((it) => io.observe(it));
		return () => io.disconnect();
	});
</script>

<section id="story" class="story" bind:this={el} aria-label="What the lab is">
	<div class="pin"><StoryVisual {active} /></div>
	<ol class="steps">
		{#each storySteps as s, i (s.title)}
			<li bind:this={items[i]} data-i={i} class:on={active === i} aria-current={active === i ? 'step' : undefined}>
				<h2 class="serif">{s.title}</h2>
				<p class="soft">{s.body}</p>
			</li>
		{/each}
	</ol>
</section>

<style>
	.story { max-width: var(--max); margin: 0 auto; padding: 0 var(--gutter); display: grid; gap: var(--space-4); }
	.pin { position: sticky; top: 0; height: 42vh; z-index: 1; background: var(--paper); }
	.steps { list-style: none; margin: 0; padding: 0; }
	li { min-height: 70vh; display: grid; align-content: center; gap: var(--space-2); opacity: 0.35; transition: opacity 0.3s; }
	li.on { opacity: 1; }
	h2 { font-size: var(--step-3); }
	p { max-width: 36ch; font-size: var(--step-1); }
	@media (min-width: 900px) {
		.story { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: start; }
		.pin { top: 10vh; height: 80vh; }
		li { min-height: 80vh; }
	}
</style>
