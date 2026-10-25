<script lang="ts">
	// One small icon set drawn in the text colour, in place of emoji (which differ per device and are read aloud).
	const PATHS = {
		play: 'M7 4.5v15l12-7.5z',
		prev: 'M15 5l-7 7 7 7',
		next: 'M9 5l7 7-7 7',
		camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
		sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11',
		mute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z M16 9.5l5 5 M21 9.5l-5 5',
		sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4',
		moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'
	};
	let { name }: { name: keyof typeof PATHS } = $props();
	const solid = $derived(name === 'play');
</script>

<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill={solid ? 'currentColor' : 'none'} stroke={solid ? 'none' : 'currentColor'} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d={PATHS[name]} /></svg>

<style>
	.icon { width: 1.1em; height: 1.1em; flex: none; vertical-align: -0.2em; }
</style>
