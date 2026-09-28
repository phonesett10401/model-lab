<script lang="ts">
	import EntryHeader from './EntryHeader.svelte';
	import PredictionBars from './PredictionBars.svelte';
	import DetectionList from './DetectionList.svelte';
	import ReportCard from './ReportCard.svelte';
	import ImageInput from './inputs/ImageInput.svelte';
	import TextInput from './inputs/TextInput.svelte';
	import AudioInput from './inputs/AudioInput.svelte';
	import TableInput from './inputs/TableInput.svelte';
	import { getRuntime, type Runtime } from '$lib/runtime';
	import { initialBench, lastResult, step, type BenchState } from '$lib/bench';
	import { latestOnly } from '$lib/latest';
	import { summarize } from '$lib/predictions';
	import { reducedMotion } from '$lib/motion.svelte';
	import type { ModelEntry, ModelInput, Sample } from '$lib/types';

	let { entry, header = true }: { entry: ModelEntry; header?: boolean } = $props();

	// ----- layout: decided by the bench's own width -----
	type Tab = 'demo' | 'data' | 'metrics' | 'fails';
	type ReportTab = Exclude<Tab, 'demo'>;
	const tabLabel: Record<Tab, string> = { demo: 'Demo', data: 'Data', metrics: 'Metrics', fails: 'Fails' };
	let width = $state(0);
	const compact = $derived(width > 0 && width < 560);
	const wide = $derived(width >= 1000);
	// Tablet / landscape phone: input and result side by side (spec §6).
	const split = $derived(width >= 600 && !wide);
	const tabs = $derived<Tab[]>(wide ? [] : compact ? ['demo', 'data', 'metrics', 'fails'] : ['data', 'metrics', 'fails']);
	let active = $state<Tab>('demo');
	const current = $derived(tabs.includes(active) ? active : tabs[0]);
	const reportShows = $derived<ReportTab[]>(wide ? ['data', 'metrics', 'fails'] : current === 'demo' ? [] : [current as ReportTab]);
	const id = $derived(`wb-${entry.slug}`);
	const detect = $derived(entry.task === 'detect');
	const sureFrom = $derived(Math.round(entry.unsureBelow * 100));

	// ----- runtime + state -----
	let runtime = $state<Runtime | null>(null);
	let checked = $state(false);
	$effect(() => {
		let gone = false;
		getRuntime(entry).then((r) => {
			if (!gone) { runtime = r; checked = true; }
		});
		return () => { gone = true; };
	});

	let loaded = false;
	let bench = $state<BenchState>(initialBench);
	const latest = latestOnly();
	const busy = $derived(bench.kind === 'loading' || bench.kind === 'examining');
	const live = $derived(checked && runtime !== null);
	const view = $derived(
		!checked ? 'ready' : !live ? 'not-live' : bench.kind === 'result' ? (bench.unsure ? 'unsure' : 'result') : bench.kind
	);
	const previous = $derived(bench.kind === 'error' ? lastResult(bench) : null);

	// On phones the answer lands below the input: bring it into view so a run never looks like nothing happened.
	let out: HTMLElement;
	$effect(() => {
		if (compact && (bench.kind === 'result' || bench.kind === 'error'))
			out.scrollIntoView({ block: 'nearest', behavior: reducedMotion.current ? 'auto' : 'smooth' });
	});

	let shownImage = $state<string | null>(null);
	let shownText = $state('');
	let shownAudio = $state<string | null>(null);
	let shownValues = $state<Record<string, string | number> | null>(null);
	/** The sample on screen, for its photo credit (null for the visitor's own photos). */
	let shownCredit = $state<Sample | null>(null);

	async function run(input: ModelInput, isLatest = latest()) {
		if (!runtime) return;
		try {
			if (!loaded) {
				bench = step(bench, { type: 'load' });
				await runtime.load((p) => { if (isLatest()) bench = step(bench, { type: 'progress', value: p }); });
				loaded = true;
			}
			if (!isLatest()) return;
			bench = step(bench, { type: 'examine' });
			const predictions = await runtime.classify(input);
			if (isLatest()) bench = step(bench, { type: 'done', predictions, threshold: entry.unsureBelow, detect });
		} catch {
			if (isLatest()) bench = step(bench, { type: 'fail', reason: 'The model failed to run. Try again.' });
		}
	}

	async function runSample(s: Sample) {
		const isLatest = latest();
		active = 'demo';
		shownCredit = s.credit ? s : null;
		const i = s.input;
		if (i.type === 'text') {
			shownText = i.text;
			run({ type: 'text', text: i.text, sampleId: s.id }, isLatest);
		} else if (i.type === 'table') {
			shownValues = { ...i.values };
			run({ type: 'table', values: i.values, sampleId: s.id }, isLatest);
		} else {
			if (i.type === 'image') shownImage = i.src;
			else shownAudio = i.src;
			const blob = await fetch(i.src).then((r) => r.blob());
			if (isLatest()) run({ type: i.type, blob, sampleId: s.id }, isLatest);
		}
	}

	const pick = (sampleId: string) => {
		const s = entry.samples.find((x) => x.id === sampleId);
		if (s) runSample(s);
	};
	const fail = (reason: string) => (bench = step(bench, { type: 'fail', reason }));
</script>

<article class="bench" class:wide class:split bind:clientWidth={width}>
	{#if header}<EntryHeader {entry} level={2} link />{/if}

	{#if tabs.length}
		<div class="tabs" role="tablist" aria-label="{entry.name} sections">
			{#each tabs as t (t)}
				<button
					role="tab" id="{id}-tab-{t}" class="tab mono"
					aria-selected={current === t}
					aria-controls={t === 'demo' ? `${id}-demo` : `${id}-${t}`}
					onclick={() => (active = t)}
				>{tabLabel[t]}</button>
			{/each}
		</div>
	{/if}

	<div class="panels">
		<section
			id="{id}-demo" class="demo" data-state={view}
			role={tabs.includes('demo') ? 'tabpanel' : undefined}
			hidden={tabs.includes('demo') && current !== 'demo'}
			aria-label="Demo"
		>
			<div class="input-col">
			{#if entry.input === 'image'}
				<ImageInput
					disabled={!live || busy} examining={bench.kind === 'examining'} bind:shown={shownImage}
					boxes={detect && bench.kind === 'result' ? bench.predictions : null}
					onsubmit={(i) => { shownCredit = null; run(i); }} onerror={fail}
				/>
				{#if shownCredit}
					<p class="mono faint credit">
						{#if shownCredit.creditUrl}<a href={shownCredit.creditUrl} target="_blank" rel="noopener">{shownCredit.credit}</a>{:else}{shownCredit.credit}{/if}
						{#if shownCredit.license}
							·
							{#if shownCredit.licenseUrl}<a href={shownCredit.licenseUrl} target="_blank" rel="noopener license">{shownCredit.license}</a>{:else}{shownCredit.license}{/if}
						{/if}
					</p>
				{/if}
			{:else if entry.input === 'text'}
				<TextInput disabled={!live || busy} examining={bench.kind === 'examining'} bind:shown={shownText} onsubmit={(i) => run(i)} onerror={fail} />
			{:else if entry.input === 'audio'}
				<AudioInput disabled={!live || busy} examining={bench.kind === 'examining'} bind:shown={shownAudio} onsubmit={(i) => run(i)} onerror={fail} />
			{:else}
				<TableInput fields={entry.fields ?? []} disabled={!live || busy} examining={bench.kind === 'examining'} bind:shown={shownValues} onsubmit={(i) => run(i)} onerror={fail} />
			{/if}

			{#if live && entry.samples.length}
				<div class="samples">
					<p class="mono faint">Try a sample:</p>
					{#each entry.samples as s (s.id)}
						<button class="btn ghost" disabled={busy} onclick={() => runSample(s)}>{s.title}</button>
					{/each}
				</div>
			{/if}

			</div>

			<div class="out" aria-live="polite" bind:this={out}>
				{#if view === 'not-live'}
					<p class="soft">This model is {entry.status === 'planned' ? 'planned' : 'still training'}. The demo opens once it has been measured, and there are no made-up results in the meantime.</p>
				{:else if bench.kind === 'loading'}
					<p class="mono">Downloading model · {runtime?.sizeLabel} · only the first time</p>
					<progress max="1" value={bench.progress ?? undefined}></progress>
					<p class="mono faint">Runs on your device. Nothing you add is uploaded.</p>
				{:else if bench.kind === 'examining'}
					<p class="mono">Examining…</p>
				{:else if bench.kind === 'result' && detect}
					<p class="answer serif">{bench.unsure ? 'No sea creatures found' : summarize(bench.predictions)}</p>
					{#if bench.unsure}
						<p class="note warn">Nothing it knows cleared {sureFrom}% confidence. It looks for: {entry.labels.join(', ')}.</p>
					{:else}
						<DetectionList predictions={bench.predictions} />
						<p class="mono faint">Shows creatures it is at least {sureFrom}% sure of.</p>
					{/if}
				{:else if bench.kind === 'result'}
					<p class="answer serif">{bench.unsure ? 'Not sure' : bench.predictions[0].label}</p>
					<PredictionBars predictions={bench.predictions} />
					{#if bench.unsure}
						<p class="note warn">Not confident. This may not be one of the {entry.labels.length} things it knows: {entry.labels.join(', ')}.</p>
					{/if}
				{:else if bench.kind === 'error'}
					<p class="note" role="alert">{bench.reason}</p>
					{#if previous}
						<p class="mono faint">Previous result:</p>
						{#if detect}<DetectionList predictions={previous} />{:else}<PredictionBars predictions={previous} />{/if}
					{/if}
				{/if}
			</div>
		</section>

		<div class="report">
			<ReportCard report={entry.report} show={reportShows} idPrefix={id} tabbed={tabs.length > 0} onpick={live ? pick : undefined} />
		</div>
	</div>
</article>

<style>
	.bench { display: grid; gap: var(--space-3); min-width: 0; }
	.tabs { display: flex; gap: var(--space-2); border-bottom: 1px solid var(--ink); overflow-x: auto; }
	.tab { min-height: 44px; background: none; border: 0; border-bottom: 2px solid transparent; padding: 0 0.2rem; cursor: pointer; color: var(--ink-soft); }
	.tab[aria-selected='true'] { color: var(--red); border-bottom-color: var(--red); }
	.panels { display: grid; gap: var(--space-4); }
	.wide .panels { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
	.demo { display: grid; gap: var(--space-2); align-content: start; }
	.demo[hidden] { display: none; }
	.input-col { display: grid; gap: var(--space-2); align-content: start; min-width: 0; }
	.split .demo { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
	.samples { display: flex; flex-wrap: wrap; gap: var(--space-1); align-items: center; }
	.out { display: grid; gap: var(--space-1); min-height: 3rem; }
	.answer { font-size: var(--step-3); line-height: 1; }
	.note { padding: 0.5rem 0.75rem; border-left: 2px solid var(--red); background: var(--plate); }
	.note.warn { border-left-color: var(--amber); }
	progress { width: 100%; accent-color: var(--ink); }
</style>
