<script lang="ts">
	import { onMount } from 'svelte';
	import { currentTheme, setTheme, type Theme } from '$lib/theme';

	let theme = $state<Theme>('light');
	onMount(() => (theme = currentTheme()));

	function toggle() {
		theme = theme === 'dark' ? 'light' : 'dark';
		setTheme(theme);
	}
</script>

<!-- Accessible name ("Switch to Light theme") contains the visible word, for voice control. -->
<button class="toggle mono" onclick={toggle}>
	<span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
	<span class="visually-hidden">Switch to</span>
	{theme === 'dark' ? 'Light' : 'Dark'}
	<span class="visually-hidden">theme</span>
</button>

<style>
	.toggle { min-height: 44px; padding: 0 var(--space-2); background: none; border: 1px solid var(--hairline); border-radius: var(--radius); cursor: pointer; }
	.toggle:hover { border-color: var(--ink); }
</style>
