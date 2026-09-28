<script lang="ts">
	import { clock } from '$lib/runtime/events';
	import type { Prediction } from '$lib/types';

	let { predictions, src, max = 20 }: { predictions: Prediction[]; src: string | null; max?: number } = $props();
	let player: HTMLAudioElement | undefined;
	let loaded = '';

	/** Plays just this stretch of the clip. */
	function play(p: Prediction) {
		if (!src) return;
		player ??= new Audio();
		if (loaded !== src) player.src = loaded = src;
		const stopAt = p.end ?? 0;
		player.ontimeupdate = () => { if (player!.currentTime >= stopAt) player!.pause(); };
		player.currentTime = p.start ?? 0;
		void player.play();
	}
	$effect(() => () => player?.pause());
</script>

<!-- Keyed by position: the same sound can happen several times. -->
<ol class="events" aria-label="Sounds heard">
	{#each predictions.slice(0, max) as p, i (i)}
		<li data-label={p.label} data-start={p.start} data-end={p.end} data-score={p.score}>
			<button class="btn ghost play" disabled={!src} onclick={() => play(p)} aria-label="Play {p.label}, {clock(p.start ?? 0)} to {clock(p.end ?? 0)}">▶</button>
			<span>{p.label}</span>
			<span class="mono faint">{clock(p.start ?? 0)}–{clock(p.end ?? 0)}</span>
			<span class="mono">{Math.round(p.score * 100)}%</span>
		</li>
	{/each}
</ol>
{#if predictions.length > max}<p class="mono faint">+{predictions.length - max} more</p>{/if}

<style>
	.events { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
	li { display: grid; grid-template-columns: 44px 1fr auto auto; gap: var(--space-1); align-items: center; }
	.play { min-height: 44px; padding: 0; }
</style>
