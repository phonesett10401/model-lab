<script lang="ts">
	import Stamp from './Stamp.svelte';
	import { pad } from '$lib/format';
	import type { AssistantSettings } from '$lib/assistant/assistants';

	let { assistant: a, selected = false }: { assistant: AssistantSettings; selected?: boolean } = $props();
</script>

<a
	class="plate"
	href="/?entry={a.slug}"
	data-slug={a.slug}
	data-path="/assistant/{a.slug}"
	aria-current={selected ? 'true' : undefined}
	data-sveltekit-noscroll
	data-sveltekit-keepfocus
	style="--accent: light-dark({a.accent.light}, {a.accent.dark})"
>
	<span class="meta mono"><i class="mark" aria-hidden="true"></i>No. {pad(a.no)} · RAG</span>
	<span class="name serif">{a.name}</span>
	<span class="stamps"><Stamp status="live" /></span>
</a>

<style>
	.plate {
		display: grid; gap: 0.3rem; min-height: 44px; padding: var(--space-2);
		background: var(--plate); border: 1px solid var(--hairline); text-decoration: none;
		transition: box-shadow 0.2s, border-color 0.2s;
	}
	.plate:hover { border-color: var(--ink-faint); }
	.plate[aria-current='true'] { box-shadow: inset 3px 0 var(--accent); border-color: var(--ink-faint); }
	.meta { display: flex; align-items: center; gap: 0.5rem; color: var(--ink-faint); letter-spacing: 0.1em; }
	.mark { width: 0.6rem; height: 0.6rem; background: var(--accent); }
	.name { font-size: var(--step-1); line-height: 1.1; }
	.stamps { display: flex; gap: 0.5rem; flex-wrap: wrap; }
</style>
