<script lang="ts">
	import ComicTranslator from '$lib/components/ComicTranslator.svelte';
</script>

<svelte:head>
	<title>Comic translator · AI Model Lab</title>
	<meta name="description" content="Translates the English text in a comic page into Burmese. The page stays on your device; only the words are sent." />
	<!-- Not listed yet: plan 3 adds the finished examples and the report card. -->
	<meta name="robots" content="noindex" />
</svelte:head>

<ComicTranslator />
