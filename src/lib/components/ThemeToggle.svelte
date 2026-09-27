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

<button class="toggle mono" onclick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
	{theme === 'dark' ? '☀ Paper' : '☾ Evening'}
</button>

<style>
	.toggle { min-height: 44px; padding: 0 var(--space-2); background: none; border: 1px solid var(--hairline); border-radius: var(--radius); cursor: pointer; }
	.toggle:hover { border-color: var(--ink); }
</style>
