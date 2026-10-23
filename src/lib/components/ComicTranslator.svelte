<script lang="ts">
	import { loadPages, type Pages } from '$lib/comic/load';

	let error = $state('');
	let book = $state<Extract<Pages, { ok: true }> | null>(null);
	let index = $state(0);
	let current = $state<ImageBitmap | null>(null);
	let original = $state<HTMLCanvasElement>();

	async function open(file: File | undefined) {
		if (!file) return;
		error = '';
		const pages = await loadPages(file);
		if (!pages.ok) {
			error = pages.reason;
			return;
		}
		book = pages;
		await show(0);
	}

	async function show(i: number) {
		if (!book) return;
		index = i;
		current = await book.page(i);
	}

	$effect(() => {
		if (!original || !current) return;
		original.width = current.width;
		original.height = current.height;
		original.getContext('2d')!.drawImage(current, 0, 0);
	});
</script>

<div class="comic">
	<h1 class="serif">Comic translator</h1>
	<label class="btn">
		Open a page (image or PDF)
		<input class="visually-hidden" type="file" aria-label="Open a comic page" accept="image/png,image/jpeg,image/webp,application/pdf"
			onchange={(e) => open(e.currentTarget.files?.[0])} />
	</label>
	{#if error}<p role="alert">{error}</p>{/if}
	{#if book}
		<nav class="pager" aria-label="Pages">
			<button class="btn" disabled={index === 0} onclick={() => show(index - 1)}>Previous page</button>
			<p class="mono">Page {index + 1} of {book.count}</p>
			<button class="btn" disabled={index === book.count - 1} onclick={() => show(index + 1)}>Next page</button>
		</nav>
		<canvas bind:this={original} role="img" aria-label="Original page"></canvas>
	{/if}
</div>

<style>
	.comic { max-width: var(--max); margin: 0 auto; padding: var(--space-4) var(--gutter); display: grid; gap: var(--space-3); }
	.pager { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
	canvas { max-width: 100%; height: auto; border: 1px solid var(--hairline); }
	[role='alert'] { color: var(--red); }
</style>
