<script lang="ts">
	import StoryVisual from './StoryVisual.svelte';
	import { enter, filled, storySteps } from '$lib/intro-story';
	import { reducedMotion } from '$lib/motion.svelte';

	let { el = $bindable() }: { el?: HTMLElement } = $props();
	let active = $state(0);
	let scrolled = $state(0);
	let built = $state(storySteps.map(() => 0));
	let items: HTMLElement[] = [];
	let list = $state<HTMLElement>();
	// Reduced motion: no scrubbing, every scene shows its finished frame.
	const p = $derived(reducedMotion.current ? 1 : scrolled);
	const t = $derived(reducedMotion.current ? built.map(() => 1) : built);
	// The picture leads the text: a scene takes the stage as soon as its step starts building.
	const scene = $derived(reducedMotion.current ? active : Math.max(0, built.findLastIndex((b) => b > 0)));

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

	$effect(() => {
		if (reducedMotion.current || !list) return;
		const steps = list;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const r = steps.getBoundingClientRect();
			scrolled = filled(r.top, r.height, innerHeight);
			built = items.map((it) => { const b = it.getBoundingClientRect(); return enter(b.top, b.height, innerHeight); });
		};
		const onScroll = () => { frame ||= requestAnimationFrame(measure); };
		measure();
		addEventListener('scroll', onScroll, { passive: true });
		addEventListener('resize', onScroll);
		return () => {
			removeEventListener('scroll', onScroll);
			removeEventListener('resize', onScroll);
			cancelAnimationFrame(frame);
		};
	});
</script>

<section id="story" class="story" bind:this={el} aria-label="What the lab is" style="--p: {p}">
	<div class="pin"><StoryVisual active={scene} {t} /></div>
	<div class="rail">
		<div class="spine" aria-hidden="true">
			<span class="fill"></span>
			{#each storySteps as s, i (s.title)}
				<span class="mark mono" style="--i: {i}" data-lit={i <= active ? '' : undefined}>{String(i + 1).padStart(2, '0')}</span>
			{/each}
		</div>
		<ol class="steps" bind:this={list}>
		{#each storySteps as s, i (s.title)}
			<li bind:this={items[i]} data-i={i} class:on={active === i} aria-current={active === i ? 'step' : undefined}>
				<h2 class="serif">{s.title}</h2>
				<p>{s.body}</p>
			</li>
		{/each}
		</ol>
	</div>
</section>

<style>
	.story { max-width: var(--max); margin: 0 auto; padding: 0 var(--gutter); display: grid; gap: var(--space-4); }
	.pin { position: sticky; top: 0; height: 42vh; z-index: 1; background: var(--paper); }
	.rail { position: relative; padding-left: 48px; }
	.steps { list-style: none; margin: 0; padding: 0; }
	li { min-height: 70vh; display: grid; align-content: center; gap: var(--space-2); }
	/* Dim inactive steps with the contrast-tested faint ink, not opacity, so they stay readable. */
	li :is(h2, p) { color: var(--ink-faint); transition: color 0.3s; }
	li.on h2 { color: var(--ink); }
	li.on p { color: var(--ink-soft); }
	h2 { font-size: var(--step-3); }
	p { max-width: 36ch; font-size: var(--step-1); }

	/* A thin red spine that fills with scroll; its markers sit beside each step and light up once reached. */
	.spine { position: absolute; left: 14px; top: 0; bottom: 0; width: 2px; background: var(--hairline); }
	.fill { position: absolute; inset: 0; background: var(--red); transform-origin: top; transform: scaleY(var(--p)); box-shadow: 0 0 12px var(--red); }
	.mark { position: absolute; left: 50%; top: calc((var(--i) + 0.5) * 25%); translate: -50% -50%; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--paper); border: 1px solid var(--hairline); color: var(--ink-faint); font-size: 11px; transition: color 0.3s, border-color 0.3s, box-shadow 0.3s; }
	.mark[data-lit] { color: var(--ink); border-color: var(--red); box-shadow: 0 0 14px color-mix(in srgb, var(--red) 70%, transparent); }

	@media (min-width: 900px) {
		.story { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: start; }
		.pin { top: 10vh; height: 80vh; }
		li { min-height: 80vh; }
	}
</style>
