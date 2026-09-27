<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { checkFile, readableImage } from '$lib/input-checks';
	import type { ModelInput } from '$lib/types';

	let {
		disabled, examining, shown = $bindable(null), onsubmit, onerror
	}: { disabled: boolean; examining: boolean; shown: string | null; onsubmit: (i: ModelInput) => void; onerror: (r: string) => void } = $props();

	const touch = new MediaQuery('pointer: coarse', false);
	let camera: HTMLInputElement;
	let upload: HTMLInputElement;
	let over = $state(false);
	let owned: string | null = null;

	async function take(file: File | null | undefined) {
		if (!file || disabled) return;
		const check = checkFile(file, 'image');
		if (!check.ok) return onerror(check.reason);
		if (!(await readableImage(file))) return onerror('That file isn’t a photo this browser can read. Try a JPG, PNG or WebP.');
		if (owned) URL.revokeObjectURL(owned);
		owned = URL.createObjectURL(file);
		shown = owned;
		onsubmit({ type: 'image', blob: file });
	}

	$effect(() => () => {
		if (owned) URL.revokeObjectURL(owned);
	});
</script>

<svelte:window onpaste={(e) => take(e.clipboardData?.files[0])} />

<div
	class="drop"
	class:over
	class:disabled
	role="region"
	aria-label="Photo"
	ondragover={(e) => { e.preventDefault(); over = !disabled; }}
	ondragleave={() => (over = false)}
	ondrop={(e) => { e.preventDefault(); over = false; take(e.dataTransfer?.files[0]); }}
>
	{#if shown}
		<img src={shown} alt="What you added, being examined" />
	{:else}
		<p class="soft">{disabled ? 'Demo opens when this model is measured' : touch.current ? 'Take or choose a photo' : 'Drop or paste a photo, or choose one'}</p>
	{/if}
	{#if examining}<span class="scan" aria-hidden="true"></span>{/if}
</div>

<div class="actions">
	{#if touch.current}
		<button class="btn" {disabled} onclick={() => camera.click()}>📷 Camera</button>
	{/if}
	<button class="btn" class:ghost={touch.current} {disabled} onclick={() => upload.click()}>Upload</button>
	<input bind:this={camera} type="file" accept="image/*" capture="environment" hidden onchange={(e) => take(e.currentTarget.files?.[0])} />
	<input bind:this={upload} type="file" accept="image/*,.heic,.heif" hidden onchange={(e) => take(e.currentTarget.files?.[0])} />
</div>

<style>
	.drop {
		position: relative; overflow: hidden; display: grid; place-items: center; text-align: center;
		aspect-ratio: 4 / 3; max-height: 50vh; padding: var(--space-2);
		border: 1.5px dashed var(--hairline);
		background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--ink) 4%, transparent) 0 6px, transparent 6px 12px);
	}
	.drop.over { border-color: var(--red); }
	.drop.disabled { opacity: 0.55; }
	img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: var(--plate); }
	.actions { display: flex; gap: var(--space-1); flex-wrap: wrap; }
	.actions .btn { flex: 1 1 8rem; }
</style>
