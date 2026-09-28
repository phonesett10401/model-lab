<script lang="ts">
	import { clock, lanes } from '$lib/runtime/events';
	import type { Prediction } from '$lib/types';

	// `from`: live mode shows a moving window of `seconds`, starting at `from`.
	let { predictions, seconds, bars = [], from = 0 }: { predictions: Prediction[]; seconds: number; bars?: number[]; from?: number } = $props();
	const names = $derived(lanes(predictions));
	const at = (t: number) => Math.max(0, Math.min(100, ((t - from) / Math.max(seconds, 0.01)) * 100));
</script>

<!-- A picture of the list below it (which carries the same events for screen readers and keyboards). -->
<figure class="timeline" aria-hidden="true">
	{#if bars.length}<div class="wave">{#each bars as b, i (i)}<i style="transform: scaleY({Math.max(0.04, b)})"></i>{/each}</div>{/if}
	{#each names as name (name)}
		<div class="lane" data-lane={name}>
			<span class="mono name">{name}</span>
			<div class="track">
				{#each predictions.filter((p) => p.label === name) as p, i (i)}
					<span class="ev" style="left: {at(p.start ?? 0)}%; width: {Math.max(0, at(p.end ?? 0) - at(p.start ?? 0))}%"></span>
				{/each}
			</div>
		</div>
	{/each}
	<div class="axis mono faint"><span>{clock(from)}</span><span>{clock(from + seconds)}</span></div>
</figure>

<style>
	.timeline { display: grid; gap: 0.35rem; margin: 0; min-width: 0; }
	.wave { height: 40px; display: flex; align-items: center; gap: 1px; background: var(--plate); border: 1px solid var(--hairline); padding: 0 2px; }
	.wave i { flex: 1; height: 100%; background: var(--ink-soft); transform-origin: center; }
	.lane { display: grid; gap: 0.15rem; }
	.name { font-size: 0.75rem; color: var(--ink-soft); }
	.track { position: relative; height: 14px; background: var(--plate); border: 1px solid var(--hairline); }
	.ev { position: absolute; top: 0; bottom: 0; min-width: 3px; background: var(--red); }
	.axis { display: flex; justify-content: space-between; font-size: 0.75rem; }
</style>
