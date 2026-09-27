<script lang="ts">
	import { onMount } from 'svelte';
	import { reducedMotion } from '$lib/motion.svelte';

	let { onskip, onended }: { onskip: () => void; onended: () => void } = $props();

	let video: HTMLVideoElement;
	let src = $state<string | undefined>(undefined);
	let poster = $state('/intro/poster-wide.jpg');
	let started = $state(false);
	let blocked = $state(false);
	let muted = $state(false);
	let progress = $state(0);

	// Chosen once on load, so we only ever download one file.
	onMount(() => {
		const tall = matchMedia('(orientation: portrait) and (max-width: 639px)').matches;
		src = tall ? '/intro/intro-tall.mp4' : '/intro/intro-wide.mp4';
		poster = tall ? '/intro/poster-tall.jpg' : '/intro/poster-wide.jpg';
	});

	// This click is the user gesture that lets the browser play with sound.
	function enter() {
		started = true;
		video.muted = false;
		video.play().catch(() => (blocked = true));
	}
	function toggleMute() {
		muted = !muted;
		video.muted = muted;
	}
	function replay() {
		video.currentTime = 0;
		video.play().catch(() => (blocked = true));
	}
</script>

<section class="stage" aria-label="Intro">
	<!-- No speech, only sound effects and ambience; the scroll story below is the text alternative (spec: captions out of scope). -->
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={video}
		{src}
		{poster}
		playsinline
		preload="auto"
		controls={blocked}
		aria-label="AI Model Lab intro, 15 seconds with sound. The story below says the same in words."
		ontimeupdate={() => (progress = video.duration ? video.currentTime / video.duration : 0)}
		{onended}
	></video>

	{#if !started}
		<div class="gate">
			<p class="mono name">AI MODEL LAB</p>
			<h1 class="serif">Explore the lab.</h1>
			<button class="btn enter" onclick={enter}>▶ Enter the lab</button>
			<p class="mono hint">🔊 Best with sound · 15 seconds</p>
			{#if reducedMotion.current}<button class="btn ghost" onclick={onskip}>Read instead</button>{/if}
		</div>
		<button class="skip mono" onclick={onskip}>Skip intro →</button>
	{:else}
		{#if blocked}<p class="mono blocked">Your browser paused it: press play to start.</p>{/if}
		<div class="controls">
			<button class="mono" onclick={toggleMute} aria-pressed={muted}>{muted ? '🔇 Unmute' : '🔊 Mute'}</button>
			<button class="mono" onclick={replay}>↻ Replay</button>
			<button class="mono" onclick={onskip}>Skip ↓</button>
		</div>
		<div class="progress" style="transform: scaleX({progress})"></div>
	{/if}
</section>

<style>
	.stage { position: relative; height: 100svh; background: var(--paper); overflow: hidden; }
	video { width: 100%; height: 100%; object-fit: contain; background: #000; }
	.gate {
		position: absolute; inset: 0; display: grid; align-content: center; justify-items: start; gap: var(--space-2);
		padding: 0 var(--gutter); background: linear-gradient(90deg, rgba(20, 18, 19, 0.92), rgba(20, 18, 19, 0.55));
	}
	.name { color: var(--red); letter-spacing: 0.2em; }
	h1 { font-size: var(--step-4); }
	.enter { min-height: 52px; font-size: var(--step-0); padding: 0 var(--space-3); }
	.hint { color: var(--ink-soft); }
	.skip { position: absolute; top: var(--space-2); right: var(--gutter); min-height: 44px; background: none; border: 0; color: var(--ink-soft); text-decoration: underline; cursor: pointer; }
	.controls { position: absolute; bottom: var(--space-2); right: var(--gutter); display: flex; gap: var(--space-1); }
	.controls button { min-height: 44px; padding: 0 var(--space-2); background: rgba(20, 18, 19, 0.7); color: #f3eeee; border: 1px solid rgba(243, 238, 238, 0.25); border-radius: var(--radius); cursor: pointer; }
	.blocked { position: absolute; top: var(--space-2); left: var(--gutter); color: #f3eeee; }
	.progress { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: var(--red); transform-origin: left; }
</style>
