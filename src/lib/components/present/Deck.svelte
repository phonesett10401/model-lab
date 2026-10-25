<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { onMount } from 'svelte';
	import { loopFor, loopSrc, slides } from '$lib/present/slides';
	import { MediaQuery } from 'svelte/reactivity';
	import { preloadAll } from '$lib/present/preload';
	import { hashFor, indexFromHash, keyAction, step, swipeAction, type Action } from '$lib/present/deck';
	import Stage from './Stage.svelte';
	import Slide from './Slide.svelte';

	let { qr, origin }: { qr: string; origin: string } = $props();

	const count = slides.length;
	let started = $state(false);
	let index = $state(0);
	let dir = $state<'forward' | 'back'>('forward');
	let cut = $state(0); // bumps on every slide change to replay the scan-wipe
	let loaded = $state(0);
	let banners = $state<Map<string, string>>(new Map());
	const portrait = new MediaQuery('orientation: portrait'); // phones held upright get the square band loops

	onMount(() => {
		const urls = slides.map((s) => loopSrc(loopFor(s, portrait.current)));
		preloadAll(urls, (d) => (loaded = d)).then((m) => (banners = m));
		const i = indexFromHash(location.hash, count);
		if (i !== null) go(i);
	});

	function onhashchange() {
		const i = indexFromHash(location.hash, count);
		if (i !== null) go(i);
	}

	function go(i: number) {
		if (i === index && started) return;
		dir = i < index ? 'back' : 'forward';
		if (started && i !== index) cut++;
		started = true;
		index = i;
		history.replaceState(null, '', i > 0 ? hashFor(i) : location.pathname);
	}

	// Start opens the cover slide (index 0); the intro video was dropped from the presentation.
	const begin = () => go(0);

	function act(action: Action) {
		if (!started) return void (action === 'next' && begin());
		if (action === 'fullscreen') {
			if (document.fullscreenElement) document.exitFullscreen();
			else document.documentElement.requestFullscreen().catch(() => {});
			return;
		}
		go(step(index, action, count));
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
		const action = keyAction(e.key);
		if (!action) return;
		e.preventDefault(); // Space would also click a focused button, so the deck handles it alone
		act(action);
	}

	// Phones: swipe up for the next slide, down to go back (like scrolling a feed).
	let touch: { x: number; y: number } | null = null;
	function ontouchstart(e: TouchEvent) {
		const t = e.changedTouches[0];
		touch = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; // ignore pinches
	}
	function ontouchend(e: TouchEvent) {
		if (!touch) return;
		const t = e.changedTouches[0];
		const action = swipeAction(t.clientX - touch.x, t.clientY - touch.y);
		touch = null;
		if (action) act(action); // swipe up on the start screen starts the deck
	}
</script>

<svelte:window {onkeydown} {onhashchange} />

<main class="present" data-index={started ? index : undefined} data-dir={dir} {ontouchstart} {ontouchend}>
	<Stage />

	{#if !started}
		<div class="gate">
			<p class="mono name">AI MODEL LAB · AI CLASS</p>
			<h1 class="serif">Project presentation</h1>
			<button class="btn start" onclick={begin}><Icon name="play" /> Start the presentation</button>
			<p class="mono hint">Space, arrows or a clicker · F for full screen</p>
			<p class="mono hint" aria-live="polite">{loaded < count ? `Loading banners… ${loaded} / ${count}` : 'Ready'}</p>
		</div>
	{/if}
	<section class="cover" class:on={started && index === 0} aria-current={started && index === 0 ? 'step' : undefined} aria-hidden={!(started && index === 0)} aria-label="Cover">
		<p class="mono kick">AI CLASS · PROJECT PROPOSAL · GROUP&nbsp;7 · 5&nbsp;LAZY&nbsp;LADS</p>
		<h2 class="serif">AI Model <em>Lab</em></h2>
		<p class="serif motto">Click it. Test it. <em>See the result.</em></p>
		<p class="mono next">PRESS SPACE OR SWIPE UP</p>
	</section>
	{#each slides as s (s.n)}
		<Slide slide={s} active={started && index === s.n} {count} loop={loopFor(s, portrait.current)} src={banners.get(loopSrc(loopFor(s, portrait.current)))}>
			{#snippet extra()}
				{#if s.n === count && qr}
					<div class="qr" data-origin={origin}>
						<p class="mono">Try it live<br /><b>{origin.replace(/^https?:\/\//, '')}</b></p>
						{@html qr /* our own build-time SVG */}
					</div>
				{/if}
			{/snippet}
		</Slide>
	{/each}
	{#key cut}{#if cut}<div class="wipe {dir}" aria-hidden="true"></div>{/if}{/key}
</main>

<style>
	/* Always dark. The build's light-dark() fallback resolves tokens at :root, so the dark values are pinned here (from tokens.css). */
	.present {
		--paper: #141213; --plate: #1d1a1b; --ink: #f3eeee; --ink-soft: #a9a1a1; --ink-faint: #938a8a;
		--red: #ff4f4f; --hairline: #2e292a; --green: #6fcf97; --on-ink: #141213;
		touch-action: none; overscroll-behavior: none; /* swipes change slides; no page scroll or pull-to-refresh */
		color-scheme: dark; position: fixed; inset: 0; overflow: hidden; background: var(--paper); color: var(--ink); }
	.gate { position: absolute; inset: 0; display: grid; align-content: center; justify-items: start; gap: var(--space-2); padding: 0 var(--gutter); background: rgba(20, 18, 19, 0.85); }
	.name { color: var(--red); letter-spacing: 0.2em; }
	h1 { font-size: var(--step-4); }
	.start { min-height: 52px; font-size: var(--step-0); padding: 0 var(--space-3); }
	.hint { color: var(--ink-soft); }
	.gate { z-index: 6; }
	/* The cover: the project name and motto, centred on the stage. */
	.cover { --u: min(1vw, 1.7778vh); position: absolute; inset: 0; z-index: 1; display: grid; place-content: center; justify-items: center; text-align: center; gap: calc(var(--u) * 1.6); padding: 0 6%; visibility: hidden; transition: visibility 0s 0.3s; }
	.cover.on { visibility: visible; transition: none; }
	.cover > * { margin: 0; opacity: 0; transform: translateY(18px); transition: opacity 0.25s, transform 0.25s; }
	.cover.on > * { opacity: 1; transform: none; transition: opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
	.cover.on > :nth-child(2) { transition-delay: 0.12s; }
	.cover.on > :nth-child(3) { transition-delay: 0.3s; }
	.cover.on > :nth-child(4) { transition-delay: 0.9s; }
	.cover .kick { color: var(--red); letter-spacing: 0.24em; font-size: calc(var(--u) * 1); }
	.cover h2 { font-weight: 400; font-size: calc(var(--u) * 11); line-height: 0.95; text-shadow: 0 0 calc(var(--u) * 4) rgba(255, 79, 79, 0.35); }
	.cover em { color: var(--red); }
	.cover .motto { font-style: italic; font-size: calc(var(--u) * 3.6); color: var(--ink); }
	.cover .next { color: var(--ink-faint); letter-spacing: 0.2em; font-size: calc(var(--u) * 0.9); margin-top: calc(var(--u) * 3); }
	@media (orientation: portrait) {
		.cover { --u: 2.45vw; }
		.cover h2 { font-size: calc(var(--u) * 7.5); }
		.cover .motto { font-size: calc(var(--u) * 2.6); }
		.cover .kick { font-size: 2.3vw; }
		.cover .next { font-size: 2.4vw; }
	}
	@media (prefers-reduced-motion: reduce) { .cover > *, .cover.on > * { transform: none; transition: opacity 0.15s; transition-delay: 0s !important; } }

	/* The broadcast cut between slides: a red scan line sweeps across once. */
	.wipe { position: absolute; top: 0; bottom: 0; width: 18%; z-index: 4; pointer-events: none; background: linear-gradient(90deg, transparent, rgba(255, 79, 79, 0.35) 80%, #ff4f4f 80.5%, transparent 81%); animation: wipe 0.45s cubic-bezier(0.6, 0, 0.4, 1) forwards; }
	.wipe.back { transform: scaleX(-1); animation-name: wipe-back; }
	@keyframes wipe { from { left: -20%; } to { left: 102%; } }
	@keyframes wipe-back { from { left: 102%; } to { left: -20%; } }
	@media (prefers-reduced-motion: reduce) { .wipe { display: none; } }
	/* Page-drawn and never animated, so it scans from the back of the room. */
	.qr { --u: min(1vw, 1.7778vh); position: absolute; z-index: 3; right: 7%; top: 64%; height: 29%; display: flex; align-items: flex-end; gap: calc(var(--u) * 1.2); }
	.qr p { margin: 0; text-align: right; font-size: calc(var(--u) * 0.95); color: var(--ink-soft); letter-spacing: 0.1em; }
	.qr b { color: var(--ink); font-weight: 400; font-size: 1.3em; }
	.qr :global(svg) { height: 100%; width: auto; display: block; }
	@media (orientation: portrait) {
		.qr { --u: 2.45vw; position: static; order: 2; flex: 1 1 0; min-height: 0; height: auto; flex-direction: column-reverse; align-items: center; justify-content: center; }
		.qr p { text-align: center; font-size: 2.6vw; }
		.qr :global(svg) { height: auto; width: min(70vw, 100%); max-height: 100%; }
	}
</style>
