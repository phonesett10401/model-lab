<script lang="ts">
	import { TEXT_LIMIT } from '$lib/input-checks';
	import type { ModelInput } from '$lib/types';

	let {
		disabled, examining, shown = $bindable(''), onsubmit
	}: { disabled: boolean; examining: boolean; shown: string; onsubmit: (i: ModelInput) => void; onerror: (r: string) => void } = $props();

	const uid = $props.id();
	const text = $derived(shown.trim());
</script>

<form class="text-input" onsubmit={(e) => { e.preventDefault(); if (text) onsubmit({ type: 'text', text }); }}>
	<label for="{uid}-t" class="mono faint">Type or paste text</label>
	<div class="field">
		<!-- maxlength only limits typing; the slice also caps pasted/programmatic text. -->
		<textarea id="{uid}-t" bind:value={shown} oninput={() => (shown = shown.slice(0, TEXT_LIMIT))} maxlength={TEXT_LIMIT} rows="4" {disabled}></textarea>
		{#if examining}<span class="sweep" aria-hidden="true"></span>{/if}
	</div>
	<div class="row">
		<span class="mono faint" aria-live="polite">{shown.length} / {TEXT_LIMIT}</span>
		<button class="btn" disabled={disabled || !text}>Examine</button>
	</div>
</form>

<style>
	.text-input { display: grid; gap: var(--space-1); }
	.field { position: relative; overflow: hidden; }
	textarea {
		width: 100%; min-height: 8rem; resize: vertical; padding: var(--space-2);
		background: var(--plate); border: 1px solid var(--hairline); border-radius: var(--radius);
	}
	.row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); }
</style>
