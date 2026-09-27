<script lang="ts">
	import type { ModelInput, TableField } from '$lib/types';

	let {
		fields, disabled, examining, shown = $bindable(null), onsubmit
	}: {
		fields: TableField[]; disabled: boolean; examining: boolean;
		shown: Record<string, string | number> | null; onsubmit: (i: ModelInput) => void; onerror: (r: string) => void;
	} = $props();

	const uid = $props.id();

	function submit(ev: SubmitEvent) {
		ev.preventDefault();
		const form = ev.currentTarget as HTMLFormElement;
		if (!form.reportValidity()) return;
		const fd = new FormData(form);
		const values: Record<string, string | number> = {};
		for (const f of fields) {
			const raw = String(fd.get(f.name) ?? '');
			values[f.name] = f.kind === 'number' ? Number(raw) : raw;
		}
		shown = values;
		onsubmit({ type: 'table', values });
	}
</script>

<form class="table-input" onsubmit={submit}>
	{#each fields as f (f.name)}
		<label for="{uid}-{f.name}">
			<span class="mono">{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
			{#if f.kind === 'number'}
				<input id="{uid}-{f.name}" name={f.name} type="number" inputmode="decimal" required
					min={f.min} max={f.max} step={f.step ?? 'any'} value={shown?.[f.name] ?? ''} {disabled} />
			{:else}
				<select id="{uid}-{f.name}" name={f.name} required {disabled} value={shown?.[f.name] ?? ''}>
					<option value="" disabled>Choose…</option>
					{#each f.options ?? [] as o (o)}<option value={o}>{o}</option>{/each}
				</select>
			{/if}
		</label>
	{/each}
	<button class="btn" {disabled}>Examine</button>
	{#if examining}<span class="sweep" aria-hidden="true"></span>{/if}
</form>

<style>
	.table-input { position: relative; overflow: hidden; display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); align-items: end; }
	label { display: grid; gap: 0.3rem; }
	input, select { min-height: 44px; padding: 0 0.6rem; background: var(--plate); border: 1px solid var(--hairline); border-radius: var(--radius); }
</style>
