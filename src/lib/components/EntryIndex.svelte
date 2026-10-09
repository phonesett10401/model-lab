<script lang="ts">
	import { goto } from '$app/navigation';
	import Plate from './Plate.svelte';
	import AssistantPlate from './AssistantPlate.svelte';
	import type { AssistantSettings } from '$lib/assistant/assistants';
	import type { Entry } from '$lib/types';

	let { entries, assistants, selected }: { entries: Entry[]; assistants: AssistantSettings[]; selected: string | null } = $props();

	const models = $derived(entries.filter((e) => e.kind === 'model'));
	const audits = $derived(entries.filter((e) => e.kind === 'audit'));

	function onkeydown(ev: KeyboardEvent) {
		const links = [...(ev.currentTarget as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.plate')];
		const i = links.indexOf(document.activeElement as HTMLAnchorElement);
		if (i < 0) return;
		const delta = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[ev.key];
		if (delta) {
			ev.preventDefault();
			const next = links[(i + delta + links.length) % links.length];
			next.focus();
			goto(`/?entry=${next.dataset.slug}`, { replaceState: true, noScroll: true, keepFocus: true });
		} else if (ev.key === 'Enter' && links[i].getAttribute('aria-current') === 'true') {
			ev.preventDefault();
			goto(links[i].dataset.path!);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav id="archive" class="index" aria-label="Archive index" {onkeydown}>
	{#if models.length}
		<h2 class="group mono">Models</h2>
		<ul>{#each models as e (e.slug)}<li><Plate entry={e} selected={e.slug === selected} /></li>{/each}</ul>
	{/if}
	{#if assistants.length}
		<h2 class="group mono">RAG assistants</h2>
		<ul>{#each assistants as a (a.slug)}<li><AssistantPlate assistant={a} selected={a.slug === selected} /></li>{/each}</ul>
	{/if}
	{#if audits.length}
		<h2 class="group mono">Audits</h2>
		<ul>{#each audits as e (e.slug)}<li><Plate entry={e} selected={e.slug === selected} /></li>{/each}</ul>
	{/if}
	<p class="hint mono faint">↑ ↓ to browse · Enter opens the page</p>
</nav>

<style>
	.index { display: grid; gap: var(--space-2); align-content: start; min-width: 0; }
	.group { color: var(--ink-faint); letter-spacing: 0.14em; text-transform: uppercase; font-weight: 500; }
	ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
	.hint { display: none; }

	@media (min-width: 640px) and (max-width: 1023px) {
		ul {
			grid-auto-flow: column; grid-auto-columns: minmax(200px, 38%);
			overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain;
			padding-bottom: var(--space-1);
		}
		li { scroll-snap-align: start; display: grid; }
	}
	@media (min-width: 1024px) {
		.index { position: sticky; top: var(--space-2); } /* no height cap: a clipped inner scroll hid plates */
		.hint { display: block; }
	}
</style>
