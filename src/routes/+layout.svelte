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
	import { findAssistant } from '$lib/assistant/assistants';

	let { children } = $props();
	onNavigate(startMorph);
	// Two sections: the models (home, model pages, their audits) and the RAG assistants (their pages and audits).
	const section = $derived.by(() => {
		const id = page.route.id ?? '';
		if (id === '/assistants' || id.startsWith('/assistant/') || (id === '/audits/[slug]' && findAssistant(page.params.slug ?? ''))) return 'rag';
		if (id === '/' || id.startsWith('/models') || id.startsWith('/audits')) return 'models';
		return null;
	});
	const bare = $derived(page.route.id === '/intro' || page.route.id === '/present' || (page.route.id?.startsWith('/og-card') ?? false));
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
			<a class="intro-link mono" href="/present">Present</a>
			<a class="intro-link mono" href="/intro"><svg class="play" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg><span class="wide">Watch the </span>intro</a>
			<ThemeToggle />
		</nav>
	</header>
	<nav class="sections" aria-label="Sections">
		<a class="tab mono" href="/" aria-current={section === 'models' ? 'page' : undefined}>Models</a>
		<a class="tab mono" href="/assistants" aria-current={section === 'rag' ? 'page' : undefined}>RAG assistants</a>
	</nav>
	<main id="main">{@render children()}</main>
	<Footer />
{/if}

<style>
	.topbar {
		max-width: var(--max); margin: 0 auto; padding: var(--space-2) var(--gutter);
		display: flex; justify-content: space-between; align-items: center; gap: var(--space-2);
	}
	.tools { display: flex; align-items: center; gap: var(--space-2); }
	.intro-link { white-space: nowrap; min-height: 44px; display: inline-flex; align-items: center; gap: 0.3em; color: var(--ink-soft); }
	.play { width: 0.7em; height: 0.7em; }
	@media (max-width: 479px) { .wide { display: none; } }
	.sections {
		max-width: var(--max); margin: 0 auto; padding: 0 var(--gutter);
		display: flex; gap: var(--space-3); border-bottom: 1px solid var(--hairline);
	}
	.tab {
		min-height: 44px; display: inline-flex; align-items: center; margin-bottom: -1px;
		color: var(--ink-soft); text-decoration: none;
		border-bottom: 2px solid transparent; transition: color 0.15s ease, border-color 0.15s ease;
	}
	.tab[aria-current='page'] { color: var(--ink); border-bottom-color: var(--red); }
	@media (hover: hover) { .tab:hover { color: var(--ink); } }
	.wordmark { white-space: nowrap; min-height: 44px; display: inline-flex; align-items: center; text-decoration: none; letter-spacing: 0.14em; color: var(--red); }
</style>
