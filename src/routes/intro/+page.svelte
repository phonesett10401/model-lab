<script lang="ts">
	import { page } from '$app/state';
	import IntroStage from '$lib/components/intro/IntroStage.svelte';
	import Story from '$lib/components/intro/Story.svelte';
	import IntroEnd from '$lib/components/intro/IntroEnd.svelte';
	import { reducedMotion } from '$lib/motion.svelte';

	let story = $state<HTMLElement>();
	let userScrolled = false;

	function toStory() {
		story?.scrollIntoView({ behavior: reducedMotion.current ? 'auto' : 'smooth' });
	}
	function ended() {
		if (!userScrolled && !reducedMotion.current) toStory();
	}
</script>

<svelte:window onscroll={() => { if (window.scrollY > 40) userScrolled = true; }} />

<svelte:head>
	<title>Intro · AI Model Lab</title>
	<meta name="description" content="A 15-second intro to AI Model Lab: small AI models, each with a report card that shows how it fails." />
	<meta property="og:title" content="AI Model Lab" />
	<meta property="og:image" content="{page.url.origin}/intro/poster-wide.jpg" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main class="intro">
	<IntroStage onskip={toStory} onended={ended} />
	<Story bind:el={story} />
	<IntroEnd />
</main>

<style>
	/* The intro is always dark: light-dark() tokens resolve against this element's scheme. */
	.intro { color-scheme: dark; background: var(--paper); color: var(--ink); min-height: 100svh; }
</style>
