<script lang="ts">
	import type { AuditStatus, ModelStatus } from '$lib/types';

	type Kind = ModelStatus | AuditStatus | 'draft' | 'sample' | 'audit' | 'missing';
	let { status }: { status: Kind } = $props();

	const text: Record<Kind, string> = {
		live: 'Live', 'in-training': 'In training', planned: 'Planned', published: 'Published',
		'in-progress': 'In progress', draft: 'Draft', sample: 'Sample', audit: 'Audit', missing: 'Missing'
	};
	const quiet = $derived(status === 'planned' || status === 'in-training' || status === 'in-progress');
</script>

<span class="stamp mono" class:quiet>{text[status]}</span>

<style>
	.stamp {
		display: inline-block; padding: 0.1em 0.5em; border: 1.5px solid var(--red); color: var(--red);
		font-size: 0.75rem; white-space: nowrap;
		transform: rotate(-4deg); animation: ink var(--dur-long) var(--ease-out) both;
	}
	.quiet { border-style: dashed; }
</style>
