<script lang="ts">
	import { page } from '$app/state';
	import AssistantCard from '$lib/components/AssistantCard.svelte';
	import Bar from '$lib/components/Bar.svelte';
	import { assistants } from '$lib/assistant/assistants';
	import { auditFor } from '$lib/assistant/audits';
	import { VERSIONS } from '$lib/assistant/config';

	// The banner is measured data, not decoration: each assistant's held-out leak rate per version, from its audit.
	const measured = assistants.flatMap((a) => {
		const audit = auditFor(a.slug);
		return audit ? [{ a, rows: audit.report.metrics.rows }] : [];
	});
</script>

<svelte:head>
	<title>RAG assistants · AI Model Lab</title>
	<meta name="description" content="Two document chatbots built to be attacked, with every leak measured before and after each defence." />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="RAG assistants · AI Model Lab" />
	<meta property="og:description" content="Two document chatbots built to be attacked, with every leak measured before and after each defence." />
	<meta property="og:image" content="{page.url.origin}/og/home.png" />
	<!-- Like the assistant pages: fictional districts and codes stay out of search results. -->
	<meta name="robots" content="noindex" />
</svelte:head>

<header class="hero">
	<div class="copy">
		
		<h1 class="serif">Ask it. Attack it. See what leaks.</h1>
		<p class="lede soft">Two document chatbots, each holding a few restricted files. They run in your browser, and every attack on them is measured with no defence, with each defence, and with all of them together.</p>
		<a class="cta btn" href="#assistants">Choose an assistant</a>
	</div>

	{#if measured.length}
		<figure class="board" aria-labelledby="board-h">
			<figcaption id="board-h" class="mono">Attacks that leaked a restricted value, on the held-out set</figcaption>
			<div class="boards">
				{#each measured as m (m.a.slug)}
					<section style="--accent: light-dark({m.a.accent.light}, {m.a.accent.dark})">
						<h2 class="mono who"><span class="mark" aria-hidden="true"></span>{m.a.name.replace(/ assistant$/, '')}</h2>
						<ol class="bars">{#each m.rows as r (r.label)}<Bar label={r.label} score={r.value} />{/each}</ol>
						<a class="mono more" href="/audits/{m.a.slug}">Read the full audit</a>
					</section>
				{/each}
			</div>
			<p class="mono faint">Lower is better. v0 has no defence; v1 is the recommended version.</p>
		</figure>
	{/if}
</header>

<section id="assistants" class="cards" aria-label="Assistants">
	{#each assistants as a (a.slug)}<div class="card"><AssistantCard assistant={a} /></div>{/each}
</section>

<section class="versions" aria-labelledby="versions-h">
	<h2 id="versions-h">The versions you can pick</h2>
	<dl>
		{#each Object.entries(VERSIONS) as [v, how] (v)}<div><dt class="mono">{v}</dt><dd>{how}</dd></div>{/each}
	</dl>
</section>

<style>
	.hero, .cards, .versions { max-width: var(--max); margin: 0 auto; padding: var(--space-3) var(--gutter); }
	.cards, .versions { margin-top: var(--section-gap); }
	.hero { padding: var(--space-4) var(--gutter) var(--space-5); display: grid; gap: var(--space-4); align-items: center; }
	.copy { display: grid; gap: var(--space-2); justify-items: start; }
	h1 { font-size: var(--step-4); line-height: 0.98; }
	.lede { max-width: 46ch; font-size: var(--step-1); }

	.board { margin: 0; display: grid; gap: var(--space-2); padding: var(--space-3); background: var(--plate); border: 1px solid var(--hairline); min-width: 0; }
	.board figcaption { color: var(--ink-faint); }
	.boards { display: grid; gap: var(--space-3); }
	.who { display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
	.mark { width: 0.6rem; height: 0.6rem; background: var(--accent); flex: none; }
	.bars { list-style: none; margin: var(--space-1) 0; padding: 0; display: grid; gap: 0.4rem; }
	.more { min-height: 44px; display: inline-flex; align-items: center; }

	.cards { display: grid; gap: var(--space-4); }
	.card { padding: var(--space-3); background: var(--plate); border: 1px solid var(--hairline); min-width: 0; }

	.versions { display: grid; gap: var(--space-2); }
	.versions h2 { font-family: var(--font-serif); font-size: var(--step-3); }
	.versions dl { margin: 0; display: grid; gap: var(--space-1); }
	.versions div { display: grid; grid-template-columns: 4ch minmax(0, 1fr); gap: var(--space-2); padding: 0.4rem 0; border-bottom: 1px solid var(--hairline); }
	.versions dt { color: var(--red); }
	.versions dd { margin: 0; max-width: 70ch; }

	@media (min-width: 640px) { .boards { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); } }
	@media (min-width: 900px) { .hero { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); } }
	@media (min-width: 1024px) { .cards { grid-template-columns: 1fr 1fr; } }
</style>
