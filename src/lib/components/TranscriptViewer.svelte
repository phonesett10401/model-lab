<script lang="ts">
	import { segments } from '$lib/transcript';
	import type { Transcript } from '$lib/types';

	let { transcripts }: { transcripts: Transcript[] } = $props();
	let i = $state(0);
	const t = $derived(transcripts[i]);
</script>

<section class="viewer" aria-label="Attack transcripts">
	<div class="nav">
		<button class="btn ghost" aria-label="Previous attack" disabled={i === 0} onclick={() => i--}>◀</button>
		<p class="mono" aria-live="polite">Attack {i + 1} of {transcripts.length} · {t.attackType}</p>
		<button class="btn ghost" aria-label="Next attack" disabled={i === transcripts.length - 1} onclick={() => i++}>▶</button>
	</div>
	<h3 class="serif">{t.title}</h3>
	<ol class="turns">
		{#each t.turns as turn, n (n)}
			<li class="turn {turn.role}">
				{#if turn.role === 'document'}<p class="mono src">retrieved: {turn.source}</p>{/if}
				<p>
					{#each segments(turn.text, turn.flagged) as s, k (k)}{#if s.flagged}<mark>{s.text}</mark>{:else}{s.text}{/if}{/each}
				</p>
			</li>
		{/each}
	</ol>
	<p class="verdict {t.verdict}">
		<strong class="mono">{t.verdict === 'defended' ? 'DEFENDED' : 'BROKEN'}</strong>
		{#if t.defence}· Defence: {t.defence}{/if} · {t.note}
	</p>
	<p class="mono faint">Read-only replay. No live chat.</p>
</section>

<style>
	.viewer { display: grid; gap: var(--space-2); }
	.nav { display: flex; align-items: center; justify-content: space-between; gap: var(--space-1); }
	.nav p { text-align: center; }
	.nav .btn { width: 44px; padding: 0; }
	h3 { font-size: var(--step-2); }
	.turns { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
	.turn { max-width: min(88%, 60ch); padding: 0.6rem 0.8rem; border: 1px solid var(--hairline); background: var(--plate); }
	.turn.user { justify-self: end; background: var(--ink); color: var(--on-ink); border-color: var(--ink); }
	.turn.document { border: 1px dashed var(--amber); font-size: var(--step--1); }
	.src { color: var(--amber); margin-bottom: 0.3rem; }
	mark { background: var(--red-wash); color: var(--ink); box-shadow: inset 0 -2px var(--red); }
	.verdict { padding: 0.5rem 0.75rem; border-left: 2px solid var(--red); background: var(--plate); }
	.verdict.defended { border-left-color: var(--green); }
	.verdict.defended strong { color: var(--green); }
	.verdict.broken strong { color: var(--red); }
</style>
