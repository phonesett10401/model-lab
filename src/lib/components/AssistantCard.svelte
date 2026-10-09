<script lang="ts">
	import Stamp from './Stamp.svelte';
	import { pad } from '$lib/format';
	import type { AssistantSettings } from '$lib/assistant/assistants';
	import { CHAT_MODEL, VERSIONS } from '$lib/assistant/config';

	let { assistant: a }: { assistant: AssistantSettings } = $props();
</script>

<article class="bench" style="--accent: light-dark({a.accent.light}, {a.accent.dark}); --on-accent: light-dark(#ffffff, #141213)">
	<header class="head">
		<p class="meta mono">No. {pad(a.no)} · RAG ASSISTANT <Stamp status="live" /></p>
		<h2 class="title serif" data-bench-title>{a.name}</h2>
		<p class="soft">{a.purpose}</p>
		<p class="mono faint">{a.fiction}</p>
	</header>
	<dl class="facts">
		<dt class="mono">Roles</dt><dd>{a.roles.map((r) => r.label).join(' / ')}</dd>
		<dt class="mono">Version</dt><dd>v0: {VERSIONS.v0}</dd>
		<dt class="mono">Model</dt><dd class="mono">{CHAT_MODEL}</dd>
		<dt class="mono">Download</dt><dd>About 1 GB the first time, then kept on your device</dd>
		<dt class="mono">Needs</dt><dd>Chrome or Edge with graphics acceleration</dd>
	</dl>
	<a class="btn open" href="/assistant/{a.slug}">Open the assistant</a>
</article>

<style>
	.bench { display: grid; gap: var(--space-3); min-width: 0; justify-items: start; }
	.head { display: grid; gap: var(--space-1); justify-items: start; }
	.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; color: var(--ink-faint); letter-spacing: 0.1em; }
	.title { font-size: var(--step-3); view-transition-name: entry-title; }
	.soft { max-width: 60ch; }
	.facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--space-1) var(--space-2); margin: 0; }
	.facts dt { color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.1em; }
	.facts dd { margin: 0; overflow-wrap: anywhere; }
	.open { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
</style>
