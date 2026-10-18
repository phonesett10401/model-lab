<script lang="ts">
	import { reducedMotion } from '$lib/motion.svelte';
	import { countup } from '$lib/present/countup';
	import type { Slide } from '$lib/present/slides';
	import { team } from '$lib/present/team';
	import Banner from './Banner.svelte';
	import type { Snippet } from 'svelte';

	let { slide, active, count, loop = slide.loop, src, extra }: { slide: Slide; active: boolean; count: number; loop?: string; src?: string; extra?: Snippet } = $props();

	const presenter = $derived(team.find((p) => p.key === slide.presenter)!);
	const pad = (n: number) => String(n).padStart(2, '0');
	let shown = $state(0);
	let built = $state(false);

	// Result slides: EXPECTED flips to BUILT ✓, then the measured number counts up from 0.
	$effect(() => {
		const stat = slide.stat;
		if (!stat) return;
		if (!active) { shown = 0; built = false; return; }
		if (reducedMotion.current) { shown = stat.value; built = true; return; }
		let raf = 0;
		const t0 = performance.now() + 400;
		const tick = (t: number) => {
			built = t >= t0;
			shown = countup(stat.value, (t - t0) / 1200);
			if (shown < stat.value) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<section class="slide" class:on={active} data-n={slide.n} data-layout={slide.layout} aria-current={active ? 'step' : undefined} aria-hidden={!active} aria-label="Slide {slide.n} of {count}">
	<header class="hud mono">
		<span>AI MODEL LAB · ACT {slide.act} · <b>PROPOSAL {slide.tag}</b></span>
		<span class="counter">LIVE {pad(slide.n)} / {pad(count)}</span>
	</header>

	<div class="copy">
		<p class="kick mono in">{slide.kicker}</p>
		<h2 class="serif in">{slide.title} {#if slide.titleEm}<em>{slide.titleEm}</em>{/if}</h2>
		{#if slide.stat}
			<p class="stat mono in"><span class="flag" class:built>{built ? 'BUILT ✓' : 'EXPECTED'}</span> {shown.toFixed(slide.stat.digits)}<small>{slide.stat.label}</small></p>
		{/if}
		<ul class="in">{#each slide.bullets as b (b)}<li>{b}</li>{/each}</ul>
	</div>

	{@render extra?.()}

	<p class="lower in"><b class="mono">NOW PRESENTING</b><span>{presenter.name} · {presenter.role}</span></p>

	<Banner layout={slide.layout} {loop} {src} {active} />
</section>

<style>
	/* One unit = 1% of a 16:9 frame that fits the window, so slides scale the same on any projector. */
	.slide { --u: min(1vw, 1.7778vh); position: absolute; inset: 0; z-index: 1; visibility: hidden; transition: visibility 0s 0.3s; }
	.slide.on { visibility: visible; transition: none; }

	.hud { position: absolute; top: 5.5%; left: 6%; right: 6%; z-index: 3; display: flex; justify-content: space-between; gap: 2em; font-size: calc(var(--u) * 0.8); letter-spacing: 0.12em; color: var(--ink-faint); }
	.hud b { color: var(--ink-soft); font-weight: 400; }
	.counter { color: var(--red); white-space: nowrap; }
	.counter::before { content: '● '; animation: blink 1.2s steps(2) infinite; }
	@keyframes blink { 50% { opacity: 0; } }
	.slide[data-layout='strip'] .hud, .slide[data-layout='slant'] .hud { right: 4%; }

	.copy { position: absolute; z-index: 3; left: 6%; top: 15%; width: 46%; }
	.slide[data-layout='strip'] .copy { width: 62%; }
	.slide[data-layout='band'] .copy { width: 85%; top: 13%; }
	/* Slide 5's real captures sit in a narrower slant (its loop is rendered 850 px wide to match). */
	.slide[data-n='5'] :global(.banner) { width: 44%; }
	.slide[data-n='5'] .copy { width: 50%; }
	.kick { font-size: calc(var(--u) * 0.95); letter-spacing: 0.2em; color: var(--red); }
	h2 { font-weight: 400; font-size: calc(var(--u) * 4.4); line-height: 1; margin: 0.25em 0 0.35em; }
	h2 em { color: var(--red); }
	ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.6em; font-size: calc(var(--u) * 1.4); line-height: 1.35; color: var(--ink-soft); }
	.slide[data-layout='band'] ul { font-size: calc(var(--u) * 1.3); gap: 0.45em; }
	.slide[data-n='9'] ul { font-size: calc(var(--u) * 1.15); gap: 0.4em; }
	li { position: relative; padding-left: 1.3em; }
	li::before { content: ''; position: absolute; left: 0; top: 0.65em; width: 0.65em; height: 1px; background: var(--red); }
	.slide[data-n='1'] li:first-child { color: var(--ink); font-family: var(--font-serif); font-style: italic; font-size: 1.5em; padding: 0; margin-bottom: 0.4em; }
	.slide[data-n='1'] li:first-child::before { display: none; }

	.stat { font-size: calc(var(--u) * 3); margin: 0 0 0.4em; display: flex; align-items: baseline; gap: 0.4em; color: var(--ink); }
	.stat small { font-size: 0.32em; color: var(--ink-faint); letter-spacing: 0.08em; }
	.flag { font-size: 0.28em; padding: 0.25em 0.6em; border: 1px solid var(--ink-faint); color: var(--ink-faint); letter-spacing: 0.15em; align-self: center; }
	.flag.built { border-color: var(--green); color: var(--green); }

	.lower { position: absolute; z-index: 3; left: 6%; bottom: 10%; display: flex; margin: 0; font-size: calc(var(--u) * 0.95); }
	.slide[data-layout='band'] .lower { bottom: 27%; }
	.lower b { font-size: inherit; background: var(--red); color: #141213; padding: 0.5em 0.8em; letter-spacing: 0.1em; font-weight: 600; }
	.lower span { background: rgba(29, 26, 27, 0.9); border: 1px solid var(--hairline); padding: 0.5em 0.9em; }

	/* Entrance: kicker → title → stat → bullets → lower-third; the banner wipes open last. */
	.in { opacity: 0; transform: translateY(14px); transition: opacity 0.25s, transform 0.25s; }
	.on .in { opacity: 1; transform: none; transition: opacity 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1); }
	.on .copy > :nth-child(2) { transition-delay: 0.09s; }
	.on .copy > :nth-child(3) { transition-delay: 0.18s; }
	.on .copy > :nth-child(4) { transition-delay: 0.27s; }
	.on .lower { transition-delay: 0.36s; }
	.slide :global(.banner) { clip-path: inset(0 0 0 100%); transition: clip-path 0.25s; }
	.slide[data-layout='slant'] :global(.banner) { clip-path: polygon(100% 0, 100% 0, 100% 100%, 100% 100%); }
	.on :global(.banner) { clip-path: inset(0); transition: clip-path 0.8s 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
	.on[data-layout='slant'] :global(.banner) { clip-path: polygon(28% 0, 100% 0, 100% 100%, 0 100%); }
	/* Going back wipes from the other side. */
	:global([data-dir='back']) .slide:not([data-layout='slant']) :global(.banner) { clip-path: inset(0 100% 0 0); }
	:global([data-dir='back']) .on:not([data-layout='slant']) :global(.banner) { clip-path: inset(0); }
	:global([data-dir='back']) .in { transform: translateY(-14px); }
	:global([data-dir='back']) .on .in { transform: none; }

	/* Phones held upright: stack header, text, banner and presenter tag top to bottom, with bigger text.
	   The banner takes the space left and shows its whole loop; the !important lines beat the widescreen geometry in Banner.svelte. */
	@media (orientation: portrait) {
		.slide { --u: 2.45vw; display: flex; flex-direction: column; gap: 3.5vw; padding: max(7vw, env(safe-area-inset-top)) 6vw max(8vw, env(safe-area-inset-bottom)); }
		.hud, .copy, .lower { position: static; width: auto !important; }
		.hud { order: 0; flex-wrap: wrap; gap: 0.4em 1em; font-size: 2.3vw; }
		.copy { order: 1; }
		.slide[data-n='9'] ul { font-size: 3.1vw; }
		.lower { order: 3; font-size: 2.6vw; }
		.slide :global(.banner) {
			order: 2; position: relative !important; inset: auto !important; width: auto !important; height: auto !important; aspect-ratio: auto !important;
			flex: 1 1 0; min-height: 0; border: 1px solid var(--hairline) !important; box-shadow: none !important;
			clip-path: none !important; opacity: 0; transition: opacity 0.25s;
		}
		.on :global(.banner) { opacity: 1; transition: opacity 0.6s 0.3s; }
		.slide :global(.banner video) { object-fit: contain; }
		/* Slide 9: the QR code takes the banner's place. */
		.slide[data-n='9'] :global(.banner) { display: none; }
	}

	@media (prefers-reduced-motion: reduce) {
		.in, .on .in { transform: none; transition: opacity 0.15s; transition-delay: 0s !important; }
		.slide :global(.banner), .on :global(.banner) { transition: opacity 0.15s; }
		.counter::before { animation: none; }
	}
</style>
