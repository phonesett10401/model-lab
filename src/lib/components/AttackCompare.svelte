<script lang="ts">
	import type { Verdict } from '$lib/assistant/compare';
	import { segments } from '$lib/transcript';
	import type { Comparison } from '$lib/types';

	let { comparisons }: { comparisons: Comparison[] } = $props();

	const NAME: Record<string, string> = { v0: 'no defence', D3: 'output check', v1: 'recommended' };
	const SAYS: Record<Verdict, string> = { leaked: 'Leaked', 'partly-leaked': 'Partly leaked', stopped: 'Stopped', safe: 'Didn’t leak', unsure: 'Unsure' };
</script>

<section class="compare" aria-labelledby="compare-h">
	<h2 id="compare-h" class="mono">Same attack, three versions</h2>
	{#each comparisons as c (c.id)}
		<article data-comparison>
			<p class="mono faint">{c.why} {c.attackType} · {c.id}</p>
			<!-- Emails can be long: the message scrolls inside its box, and the box takes keyboard focus so it can be scrolled. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="msg" tabindex="0" role="group" aria-label="The attack message">
				{#each c.messages as m, i (i)}<p>{#each segments(m.text, m.flagged) as s, k (k)}{#if s.flagged}<mark>{s.text}</mark>{:else}{s.text}{/if}{/each}</p>{/each}
			</div>
			<ol class="cells">
				{#each c.cells as cell (cell.version)}
					<li>
						<h3 class="mono" data-version>{cell.version} · {NAME[cell.version] ?? ''}</h3>
						<p class="mono verdict" data-verdict={cell.verdict}>{SAYS[cell.verdict]}{#if cell.by}{' '}by {cell.by}{/if}</p>
						{#each cell.replies as r, i (i)}<p class="reply">{r || '(no reply)'}</p>{/each}
					</li>
				{/each}
			</ol>
		</article>
	{/each}
</section>

<style>
	.compare { display: grid; gap: var(--space-2); }
	.compare h2 { font-size: var(--step--1); color: var(--red); letter-spacing: 0.1em; text-transform: uppercase; }
	article { display: grid; gap: var(--space-1); padding: var(--space-2); border: 1px solid var(--hairline); background: var(--plate); min-width: 0; }
	.msg { max-height: 12rem; overflow: auto; padding: var(--space-1) var(--space-2); border-left: 3px solid var(--hairline); }
	.msg p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
	mark { background: none; color: inherit; text-decoration: underline 2px var(--red); text-underline-offset: 3px; font-weight: 600; }
	.cells { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
	.cells li { display: grid; gap: 0.3rem; align-content: start; padding-top: var(--space-1); border-top: 2px solid var(--hairline); min-width: 0; }
	h3 { font-size: var(--step--1); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; }
	.verdict { margin: 0; font-weight: 600; }
	.verdict[data-verdict='leaked'], .verdict[data-verdict='partly-leaked'] { color: var(--red); }
	li:has([data-verdict='leaked']), li:has([data-verdict='partly-leaked']) { border-top-color: var(--red); }
	.reply { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; max-width: 65ch; }
	@media (min-width: 900px) { .cells { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
