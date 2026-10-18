<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { loopSrc, slides } from '$lib/present/slides';
	import { preloadAll } from '$lib/present/preload';
	import { hashFor, indexFromHash, keyAction, step, swipeAction, type Action } from '$lib/present/deck';
	import Stage from './Stage.svelte';
	import Slide from './Slide.svelte';

	let { qr, origin }: { qr: string; origin: string } = $props();

	const count = slides.length;
	let video = $state<HTMLVideoElement>();
	let started = $state(false);
	let blocked = $state(false);
	let index = $state(0);
	let dir = $state<'forward' | 'back'>('forward');
	let cut = $state(0); // bumps on every slide change to replay the scan-wipe
	let loaded = $state(0);
	let banners = $state<Map<string, string>>(new Map());

	onMount(() => {
		const urls = slides.map((s) => loopSrc(s.loop));
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
		if (i > 0) video?.pause(); // leaving the intro stops it, not keeps playing off-screen
		history.replaceState(null, '', hashFor(i));
	}

	// This click is the user gesture that lets the browser play with sound: play() must run before any await.
	async function begin() {
		started = true;
		index = 0;
		if (video) {
			video.muted = false;
			video.play().catch(() => (blocked = true));
		}
		await tick();
	}

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
		if (action) act(action); // a touchend is a user gesture, so starting the intro with sound still works
	}
</script>

<svelte:window {onkeydown} {onhashchange} />

<main class="present" data-index={started ? index : undefined} data-dir={dir} {ontouchstart} {ontouchend}>
	<Stage />

	<!-- No speech, only music and sound effects; the slides that follow say the same in words. -->
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		class="intro"
		class:hidden={!started || index !== 0}
		bind:this={video}
		src="/intro/intro-wide.mp4"
		poster="/intro/poster-wide.jpg"
		playsinline
		preload="auto"
		controls={blocked}
		aria-label="AI Model Lab intro, 21 seconds with sound"
		onplay={() => (blocked = false)}
	></video>

	{#if !started}
		<div class="gate">
			<p class="mono name">AI MODEL LAB · AI CLASS</p>
			<h1 class="serif">Project presentation</h1>
			<button class="btn start" onclick={begin}>▶ Start the presentation</button>
			<p class="mono hint">Space, arrows or a clicker · F for full screen</p>
			<p class="mono hint" aria-live="polite">{loaded < count ? `Loading banners ${loaded} / ${count}` : 'Ready'}</p>
		</div>
	{/if}
	{#each slides as s (s.n)}
		<Slide slide={s} active={started && index === s.n} {count} src={banners.get(loopSrc(s.loop))}>
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
	video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000; }
	.hidden { visibility: hidden; }
	.gate { position: absolute; inset: 0; display: grid; align-content: center; justify-items: start; gap: var(--space-2); padding: 0 var(--gutter); background: rgba(20, 18, 19, 0.85); }
	.name { color: var(--red); letter-spacing: 0.2em; }
	h1 { font-size: var(--step-4); }
	.start { min-height: 52px; font-size: var(--step-0); padding: 0 var(--space-3); }
	.hint { color: var(--ink-soft); }
	video { z-index: 5; }
	.gate { z-index: 6; }
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
</style>
