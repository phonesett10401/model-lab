<script lang="ts">
	import '@fontsource-variable/geist';
	import '@fontsource-variable/jetbrains-mono';
	import '@fontsource/instrument-serif/400.css';
	import '@fontsource/instrument-serif/400-italic.css';
	// Preload the hero's fonts so the headline doesn't reflow (layout shift) when they arrive.
	import serif from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
	import serifItalic from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url';
	import sans from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url';
	import '$lib/styles/tokens.css';
	import '$lib/styles/base.css';
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { startMorph } from '$lib/morph';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
	onNavigate(startMorph);
	const bare = $derived(page.route.id === '/intro' || (page.route.id?.startsWith('/og-card') ?? false));
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	{#each [serif, serifItalic, sans] as href (href)}<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" {href} />{/each}
</svelte:head>

{#if bare}
	{@render children()}
{:else}
	<a class="skip" href="#main">Skip to content</a>
	<header class="topbar">
		<a class="wordmark mono" href="/">AI MODEL LAB</a>
		<nav class="tools">
			<a class="intro-link mono" href="/intro"><span aria-hidden="true">▶</span> <span class="wide">Watch the </span>intro</a>
			<ThemeToggle />
		</nav>
	</header>
	<main id="main">{@render children()}</main>
	<Footer />
{/if}

<style>
	.topbar {
		max-width: var(--max); margin: 0 auto; padding: var(--space-2) var(--gutter);
		display: flex; justify-content: space-between; align-items: center; gap: var(--space-2);
	}
	.tools { display: flex; align-items: center; gap: var(--space-2); }
	.intro-link { min-height: 44px; display: inline-flex; align-items: center; gap: 0.3em; color: var(--ink-soft); }
	@media (max-width: 479px) { .wide { display: none; } }
	.wordmark { text-decoration: none; letter-spacing: 0.14em; color: var(--red); }
</style>
