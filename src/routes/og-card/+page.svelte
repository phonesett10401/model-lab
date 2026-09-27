<script lang="ts">
	import { catalogue } from '$lib/entries';
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>
<ul>
	<li><a href="/og-card/home">home</a></li>
	{#each catalogue as e (e.slug)}<li><a href="/og-card/{e.slug}">{e.slug}</a></li>{/each}
</ul>
