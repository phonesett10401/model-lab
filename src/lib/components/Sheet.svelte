<script lang="ts">
	import type { Snippet } from 'svelte';

	let { open, label, onclose, children }: { open: boolean; label: string; onclose: () => void; children: Snippet } = $props();

	let dialog: HTMLDialogElement;
	let startY: number | null = null;
	let dy = $state(0);

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function down(e: PointerEvent) {
		startY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (startY !== null) dy = Math.max(0, e.clientY - startY);
	}
	function up() {
		if (dy > 90) onclose();
		startY = null;
		dy = 0;
	}
</script>

<dialog
	bind:this={dialog}
	class="sheet"
	aria-label={label}
	style="--dy: {dy}px"
	oncancel={(e) => { e.preventDefault(); onclose(); }}
>
	<div class="grip" role="presentation" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
		<span class="handle"></span>
	</div>
	<button class="close btn ghost" onclick={onclose} aria-label="Close">✕</button>
	<div class="body">{@render children()}</div>
</dialog>

<style>
	.sheet {
		width: 100%; max-width: 100%; height: 100dvh; max-height: 100dvh; margin: 0; padding: 0;
		border: 0; border-top: 2px solid var(--red); background: var(--paper); color: var(--ink);
		transform: translateY(var(--dy));
		transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), overlay 0.32s allow-discrete, display 0.32s allow-discrete;
	}
	.sheet:not([open]) { transform: translateY(100%); }
	@starting-style { .sheet[open] { transform: translateY(100%); } }
	.sheet::backdrop { background: color-mix(in srgb, var(--ink) 40%, transparent); }
	.grip { display: grid; place-items: center; height: 28px; touch-action: none; cursor: grab; }
	.handle { width: 40px; height: 4px; border-radius: 2px; background: var(--hairline); }
	.close { position: absolute; top: 0.25rem; right: 0.5rem; width: 44px; padding: 0; }
	.body { padding: 0 var(--gutter) var(--space-5); overflow-y: auto; height: calc(100% - 28px); overscroll-behavior: contain; }
</style>
