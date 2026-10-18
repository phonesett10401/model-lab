<script lang="ts">
	import { loopSrc, posterSrc, type BannerLayout } from '$lib/present/slides';

	let { layout, loop, src, active }: { layout: BannerLayout; loop: string; src?: string; active: boolean } = $props();
	let video = $state<HTMLVideoElement>();

	// Only the slide on screen plays; a video that fails to load keeps showing its poster.
	$effect(() => {
		if (!video) return;
		if (active) video.play().catch(() => {});
		else video.pause();
	});
</script>

<div class="banner" data-layout={layout}>
	<video bind:this={video} src={src ?? loopSrc(loop)} poster={posterSrc(loop)} muted loop playsinline preload="auto" aria-hidden="true"></video>
</div>

<style>
	.banner { position: absolute; z-index: 2; overflow: hidden; background: #0e0d0d; }
	video { width: 100%; height: 100%; object-fit: cover; display: block; }
	.banner[data-layout='strip'] { right: 0; top: 0; bottom: 0; width: 25%; border-left: 1px solid rgba(255, 79, 79, 0.5); }
	.banner[data-layout='slant'] { right: 0; top: 0; bottom: 0; width: 52%; clip-path: polygon(28% 0, 100% 0, 100% 100%, 0 100%); }
	.banner[data-layout='monitor'] {
		right: 7%; top: 18%; width: 40%; aspect-ratio: 16 / 10;
		border: 1px solid var(--hairline); box-shadow: 0 0 40px rgba(255, 79, 79, 0.25);
	}
	.banner[data-layout='band'] { left: 0; right: 0; bottom: 0; height: 24%; border-top: 1px solid rgba(255, 79, 79, 0.5); }
</style>
