<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { slides } from '$lib/present/slides';
	import { hashFor, indexFromHash, keyAction, step } from '$lib/present/deck';

	let { qr }: { qr: string } = $props();

	const count = slides.length;
	let video = $state<HTMLVideoElement>();
	let started = $state(false);
	let blocked = $state(false);
	let index = $state(0);

	onMount(() => {
		const i = indexFromHash(location.hash, count);
		if (i !== null) go(i);
	});

	function go(i: number) {
		if (i === index && started) return;
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

	function onkeydown(e: KeyboardEvent) {
		if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
		const action = keyAction(e.key);
		if (!action) return;
		e.preventDefault(); // Space would also click a focused button, so the deck handles it alone
		if (!started) return void (action === 'next' && begin());
		if (action === 'fullscreen') {
			if (document.fullscreenElement) document.exitFullscreen();
			else document.documentElement.requestFullscreen().catch(() => {});
			return;
		}
		go(step(index, action, count));
	}
</script>

<svelte:window {onkeydown} />

<main class="present" data-index={started ? index : undefined}>
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
		</div>
	{:else if index > 0}
		{#each slides as s (s.n)}
			{#if s.n === index}
				<section class="slide" data-n={s.n} aria-current="step" aria-label="Slide {s.n} of {count}">
					<h2>{s.title} {s.titleEm}</h2>
					<ul>{#each s.bullets as b (b)}<li>{b}</li>{/each}</ul>
				</section>
			{/if}
		{/each}
		<p class="mono counter">LIVE {String(index).padStart(2, '0')} / {String(count).padStart(2, '0')}</p>
	{/if}
	{#if qr}<!-- QR markup arrives in Task 4 -->{/if}
</main>

<style>
	.present { color-scheme: dark; position: fixed; inset: 0; overflow: hidden; background: var(--paper); color: var(--ink); }
	video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000; }
	.hidden { visibility: hidden; }
	.gate { position: absolute; inset: 0; display: grid; align-content: center; justify-items: start; gap: var(--space-2); padding: 0 var(--gutter); background: rgba(20, 18, 19, 0.85); }
	.name { color: var(--red); letter-spacing: 0.2em; }
	h1 { font-size: var(--step-4); }
	.start { min-height: 52px; font-size: var(--step-0); padding: 0 var(--space-3); }
	.hint { color: var(--ink-soft); }
	.counter { position: absolute; top: 4%; right: 4%; color: var(--red); }
</style>
