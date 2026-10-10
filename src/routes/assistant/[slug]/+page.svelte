<script lang="ts">
	import AssistantChat from '$lib/components/AssistantChat.svelte';
	import { findAssistant } from '$lib/assistant/assistants';

	let { data } = $props();
	const assistant = $derived(findAssistant(data.slug)!);
</script>

<svelte:head>
	<title>{assistant.name} · AI Model Lab</title>
	<meta name="description" content={assistant.purpose} />
	<!-- Fictional shelters and codes must never surface in search results. -->
	<meta name="robots" content="noindex" />
</svelte:head>

<!-- Keyed: moving between assistants starts a fresh chat with the right roles. -->
{#key data.slug}<AssistantChat {assistant} passages={data.passages} secrets={data.secrets} />{/key}
