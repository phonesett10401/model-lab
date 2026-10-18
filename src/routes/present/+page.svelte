<script lang="ts">
	import Deck from '$lib/components/present/Deck.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Presentation · AI Model Lab</title>
	<meta name="robots" content="noindex" />
	<meta name="description" content="AI Model Lab's class presentation: the lab, how the models are made, real results and what's next." />
</svelte:head>

<Deck qr={data.qr} origin={data.origin} />
