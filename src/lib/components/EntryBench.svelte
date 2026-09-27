<script lang="ts">
	import Workbench from './Workbench.svelte';
	import AuditBench from './AuditBench.svelte';
	import type { Entry } from '$lib/types';

	let { entry }: { entry: Entry } = $props();
</script>

{#key entry.slug}
	{#if entry.kind === 'model'}<Workbench {entry} />{:else}<AuditBench {entry} />{/if}
{/key}
