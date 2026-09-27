<script lang="ts">
	import '@fontsource-variable/geist';
	import '@fontsource-variable/jetbrains-mono';
	import '@fontsource/instrument-serif/400.css';
	import '@fontsource/instrument-serif/400-italic.css';
	import '$lib/styles/tokens.css';
	import '$lib/styles/base.css';
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { startMorph } from '$lib/morph';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
	onNavigate(startMorph);
	const bare = $derived(page.route.id?.startsWith('/og-card') ?? false);
</script>

<svelte:head><link rel="icon" href="/favicon.svg" /></svelte:head>

{#if bare}
	{@render children()}
{:else}
	<a class="skip" href="#main">Skip to content</a>
	<header class="topbar">
		<a class="wordmark mono" href="/">SPECIMEN ARCHIVE</a>
		<ThemeToggle />
	</header>
	<main id="main">{@render children()}</main>
	<Footer />
{/if}

<style>
	.topbar {
		max-width: var(--max); margin: 0 auto; padding: var(--space-2) var(--gutter);
		display: flex; justify-content: space-between; align-items: center; gap: var(--space-2);
	}
	.wordmark { text-decoration: none; letter-spacing: 0.14em; color: var(--red); }
</style>
