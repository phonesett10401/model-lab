<script lang="ts">
	import { goto } from '$app/navigation';
	import Plate from './Plate.svelte';
	import { entryPath } from '$lib/format';
	import type { Entry } from '$lib/types';

	let { entries, selected }: { entries: Entry[]; selected: string | null } = $props();

	const groups = $derived(
		[
			{ title: 'Models', items: entries.filter((e) => e.kind === 'model') },
			{ title: 'Audits', items: entries.filter((e) => e.kind === 'audit') }
		].filter((g) => g.items.length)
	);

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
			const e = entries.find((x) => x.slug === links[i].dataset.slug);
			if (e) goto(entryPath(e));
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav id="archive" class="index" aria-label="Archive index" {onkeydown}>
	{#each groups as g (g.title)}
		<h2 class="group mono">{g.title}</h2>
		<ul>
			{#each g.items as e (e.slug)}
				<li><Plate entry={e} selected={e.slug === selected} /></li>
			{/each}
		</ul>
	{/each}
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
		.index { position: sticky; top: var(--space-2); max-height: calc(100dvh - 2 * var(--space-2)); overflow: auto; }
		.hint { display: block; }
	}
</style>
