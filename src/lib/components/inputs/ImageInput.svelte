<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { checkFile, readableImage } from '$lib/input-checks';
	import { tagStyle } from '$lib/tags';
	import type { ModelInput, Prediction } from '$lib/types';

	let {
		disabled, examining, shown = $bindable(null), boxes = null, onsubmit, onerror
	}: {
		disabled: boolean; examining: boolean; shown: string | null;
		/** Detections to draw over the photo (boxes are fractions of the photo). */
		boxes?: Prediction[] | null;
		onsubmit: (i: ModelInput) => void; onerror: (r: string) => void;
	} = $props();
	let ar = $state(4 / 3);

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
		<!-- The frame takes the photo's own shape, so boxes given as fractions land exactly on it. -->
		<div class="frame" style="--ar: {ar}">
			<img src={shown} alt="What you added, being examined" onload={(e) => { const img = e.currentTarget as HTMLImageElement; ar = img.naturalWidth / img.naturalHeight; }} />
			{#if boxes?.length}
				<svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
					{#each boxes as b, i (i)}
						{#if b.box}<rect x={b.box[0]} y={b.box[1]} width={b.box[2] - b.box[0]} height={b.box[3] - b.box[1]} />{/if}
					{/each}
				</svg>
				{#each boxes.slice(0, 12) as b, i (i)}
					{#if b.box}<span class="tag mono" aria-hidden="true" style={tagStyle(b.box)}>{i + 1} {b.label}</span>{/if}
				{/each}
			{/if}
		</div>
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
	.drop { container-type: size; }
	.frame { position: relative; width: min(100cqw, calc(100cqh * var(--ar))); aspect-ratio: var(--ar); }
	.frame img { display: block; width: 100%; height: 100%; background: var(--plate); }
	svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
	rect { fill: none; stroke: var(--red); stroke-width: 2px; vector-effect: non-scaling-stroke; }
	.tag { position: absolute; background: var(--red); color: var(--on-ink); font-size: 11px; line-height: 1.4; padding: 0 4px; white-space: nowrap; pointer-events: none; }
	.actions { display: flex; gap: var(--space-1); flex-wrap: wrap; }
	.actions .btn { flex: 1 1 8rem; }
</style>
