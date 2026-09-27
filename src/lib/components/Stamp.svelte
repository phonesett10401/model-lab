<script lang="ts">
	import type { AuditStatus, ModelStatus } from '$lib/types';

	type Kind = ModelStatus | AuditStatus | 'draft' | 'sample' | 'audit' | 'missing';
	let { status }: { status: Kind } = $props();

	const text: Record<Kind, string> = {
		live: 'LIVE', 'in-training': 'IN TRAINING', planned: 'PLANNED', published: 'PUBLISHED',
		'in-progress': 'IN PROGRESS', draft: 'DRAFT', sample: 'SAMPLE', audit: 'AUDIT', missing: 'MISSING'
	};
	const quiet = $derived(status === 'planned' || status === 'in-training' || status === 'in-progress');
</script>

<span class="stamp mono" class:quiet>{text[status]}</span>

<style>
	.stamp {
		display: inline-block; padding: 0.1em 0.5em; border: 1.5px solid var(--red); color: var(--red);
		font-size: 0.7rem; letter-spacing: 0.12em; white-space: nowrap;
		transform: rotate(-4deg); animation: ink 0.5s cubic-bezier(0.2, 1.6, 0.4, 1) both;
	}
	.quiet { border-style: dashed; }
</style>
