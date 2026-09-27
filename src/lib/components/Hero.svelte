<script lang="ts">
	import Stamp from './Stamp.svelte';
	import PredictionBars from './PredictionBars.svelte';
	import { heroSpecimens } from '$lib/hero-specimens';
	import { reducedMotion } from '$lib/motion.svelte';
	import { segments } from '$lib/transcript';

	let i = $state(0);
	let paused = $state(false);
	const s = $derived(heroSpecimens[i]);
	const wave = Array.from({ length: 36 }, (_, n) => 0.2 + Math.abs(Math.sin(n * 1.7)) * 0.8);

	$effect(() => {
		if (reducedMotion.current || paused) return;
		const id = setInterval(() => {
			if (!document.hidden) i = (i + 1) % heroSpecimens.length;
		}, 5000);
		return () => clearInterval(id);
	});
</script>

<header class="hero">
	<div class="copy">
		<p class="kicker mono">SPECIMEN ARCHIVE · VOL. 01</p>
		<h1 class="serif">See what it sees. <em>And where it’s wrong.</em></h1>
		<p class="lede soft">Small AI models I train, and audits of models I attack. Each has a report card that shows how it fails.</p>
		<a class="cta btn" href="#archive">Open the archive ↓</a>
	</div>

	<figure
		class="plate" data-kind={s.kind} aria-label="Sample specimen: {s.label.toLowerCase()}"
		onmouseenter={() => (paused = true)} onmouseleave={() => (paused = false)}
		onfocusin={() => (paused = true)} onfocusout={() => (paused = false)}
	>
		<figcaption class="mono">No. {s.label} · EXAMINING… <Stamp status="sample" /></figcaption>
		{#key i}
			<div class="specimen">
				{#if s.kind === 'image'}
					<img src={s.src} alt="Illustration of an octopus" width="240" height="180" />
					<span class="scan" aria-hidden="true"></span>
				{:else if s.kind === 'audio'}
					<div class="wave" aria-hidden="true">{#each wave as h, n (n)}<i style="transform: scaleY({h})"></i>{/each}</div>
					<span class="playhead" aria-hidden="true"></span>
				{:else}
					<p class:chat={s.kind === 'chat'}>
						{#each segments(s.text ?? '', s.flagged) as seg, k (k)}{#if seg.flagged}<mark>{seg.text}</mark>{:else}{seg.text}{/if}{/each}
					</p>
					<span class="sweep" aria-hidden="true"></span>
				{/if}
			</div>
			<PredictionBars predictions={s.predictions} />
		{/key}
		<div class="dots">
			{#each heroSpecimens as h, n (n)}
				<button aria-label="Show {h.label.toLowerCase()} sample" aria-pressed={n === i} onclick={() => (i = n)}></button>
			{/each}
		</div>
	</figure>
</header>

<style>
	.hero {
		max-width: var(--max); margin: 0 auto; padding: var(--space-4) var(--gutter) var(--space-5);
		display: grid; gap: var(--space-4); align-items: center;
	}
	@media (min-width: 640px) { .hero { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); } }
	.copy { display: grid; gap: var(--space-2); justify-items: start; }
	.kicker { color: var(--red); letter-spacing: 0.14em; }
	h1 { font-size: var(--step-4); line-height: 0.98; }
	h1 em { color: var(--red); }
	.lede { max-width: 46ch; font-size: var(--step-1); }
	.plate { margin: 0; background: var(--plate); border: 1px solid var(--hairline); padding: var(--space-2); display: grid; gap: var(--space-2); }
	figcaption { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; color: var(--ink-faint); }
	.specimen {
		position: relative; overflow: hidden; aspect-ratio: 4 / 3; display: grid; place-items: center; padding: var(--space-2);
		background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--ink) 4%, transparent) 0 6px, transparent 6px 12px);
	}
	.specimen img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
	.specimen p { font-size: var(--step-1); text-align: center; }
	.specimen p.chat { font-family: var(--font-mono); font-size: var(--step--1); text-align: left; }
	mark { background: var(--red-wash); color: var(--ink); box-shadow: inset 0 -2px var(--red); }
	.wave { display: flex; align-items: center; gap: 3px; width: 100%; height: 60%; }
	.wave i { flex: 1; height: 100%; background: var(--ink); transform-origin: center; }
	.dots { display: flex; gap: 0.25rem; justify-content: center; }
	.dots button { width: 44px; height: 44px; background: none; border: 0; cursor: pointer; display: grid; place-items: center; }
	.dots button::after { content: ''; width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--ink-faint); }
	.dots button[aria-pressed='true']::after { background: var(--red); border-color: var(--red); }
</style>
