<script lang="ts">
	import { onMount } from 'svelte';
	import { checkLines } from '$lib/comic/check';
	import { serviceInfo, translatePage } from '$lib/comic/client';
	import { loadPages, type Pages } from '$lib/comic/load';
	import { readingOrder } from '$lib/comic/order';
	import { renderPage } from '$lib/comic/render';
	import '@fontsource/noto-sans-myanmar/400.css';
	import type { Box, LineProblem, Region, RegionClass, SentLine, Speaker } from '$lib/comic/types';

	const CLASSES: RegionClass[] = ['bubble', 'caption', 'sfx', 'art-text'];
	const SPEAKERS: Speaker[] = ['unknown', 'man', 'woman', 'child', 'narrator'];
	const PROBLEMS: Record<LineProblem, string> = {
		missing: 'Didn’t come back. Retry or type your own.',
		'not-burmese': 'Didn’t come back in Burmese. Retry or type your own.',
		zawgyi: 'Came back in Zawgyi, not Unicode. Retry or type your own.',
		length: 'The length looks off. Check it, retry or type your own.'
	};

	let error = $state('');
	let info = $state<{ model: string; tier: 'free' | 'paid' } | null>(null);
	let book = $state<Extract<Pages, { ok: true }> | null>(null);
	let index = $state(0);
	let current = $state<ImageBitmap | null>(null);
	let original = $state<HTMLCanvasElement>();
	let burmeseCanvas = $state<HTMLCanvasElement>();
	let busy = $state(false);
	/** Regions per page; numbers shown to the visitor follow reading order. */
	let byPage = $state<Region[][]>([]);
	let nextId = 0;
	let drag = $state<{ x: number; y: number; box: Box } | null>(null);

	const regions = $derived(readingOrder(byPage[index] ?? []));
	const sent = $derived<SentLine[]>(
		regions.map((r, i) => ({ n: i + 1, text: r.english.trim(), cls: r.cls, speaker: r.speaker })).filter((l) => l.text)
	);

	onMount(async () => { info = await serviceInfo(); });

	async function open(file: File | undefined) {
		if (!file) return;
		error = '';
		const pages = await loadPages(file);
		if (!pages.ok) {
			error = pages.reason;
			return;
		}
		book = pages;
		byPage = Array.from({ length: pages.count }, () => []);
		await show(0);
	}

	async function show(i: number) {
		if (!book) return;
		index = i;
		current = await book.page(i);
	}

	$effect(() => {
		if (!original || !current) return;
		original.width = current.width;
		original.height = current.height;
		original.getContext('2d')!.drawImage(current, 0, 0);
	});

	let rendered = $state(false);
	let renderToken = 0;
	$effect(() => {
		if (!burmeseCanvas || !current) return;
		// Snapshot now so the effect tracks every box and text it draws.
		const snap = regions.map((r) => ({ ...r, box: { ...r.box } }));
		const page = current;
		const token = ++renderToken;
		rendered = false;
		const off = document.createElement('canvas');
		off.width = page.width;
		off.height = page.height;
		renderPage(off.getContext('2d', { willReadFrequently: true })!, page, snap).then(() => {
			if (token !== renderToken || !burmeseCanvas) return;
			burmeseCanvas.width = page.width;
			burmeseCanvas.height = page.height;
			burmeseCanvas.getContext('2d')!.drawImage(off, 0, 0);
			rendered = snap.some((r) => r.burmese.trim());
		});
	});

	function download() {
		burmeseCanvas?.toBlob((blob) => {
			if (!blob) return;
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = `comic-page-${index + 1}-my.png`;
			a.click();
			URL.revokeObjectURL(a.href);
		}, 'image/png');
	}

	/** Pointer position in page pixels. */
	function at(e: PointerEvent) {
		const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		return { x: ((e.clientX - r.left) / r.width) * current!.width, y: ((e.clientY - r.top) / r.height) * current!.height };
	}
	function down(e: PointerEvent) {
		if (!current) return;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		const p = at(e);
		drag = { ...p, box: { ...p, w: 0, h: 0 } };
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const p = at(e);
		drag.box = { x: Math.min(p.x, drag.x), y: Math.min(p.y, drag.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) };
	}
	function up() {
		if (drag && drag.box.w >= 8 && drag.box.h >= 8)
			byPage[index].push({ id: nextId++, box: drag.box, cls: 'bubble', speaker: 'unknown', english: '', burmese: '', problem: null });
		drag = null;
	}
	function remove(id: number) {
		byPage[index] = byPage[index].filter((r) => r.id !== id);
	}

	/** Sends the page's text. With onlyFlagged, every line is sent again for context but only flagged rows change. */
	async function translate(onlyFlagged = false) {
		if (!sent.length) return;
		busy = true;
		error = '';
		const lines = sent;
		const order = regions;
		const reply = await translatePage(lines);
		busy = false;
		if (!reply.ok) {
			error = reply.error === 'quota' ? 'Today’s translations are used up. Try again tomorrow.' : 'Translation failed. Try again in a moment.';
			return;
		}
		const { byN } = checkLines(lines, reply.lines);
		for (const l of lines) {
			const r = order[l.n - 1];
			if (onlyFlagged && !r.problem) continue;
			const got = byN.get(l.n)!;
			r.burmese = got.text || r.burmese;
			r.problem = got.problem;
		}
	}
</script>

<div class="comic">
	<header class="head">
		<h1 class="serif">Comic translator</h1>
		<p class="soft">English to Burmese. Your page stays on your device; only the words you type below are sent to be translated.</p>
		{#if info}
			<p class="mono tier">
				Translating with {info.model}{info.tier === 'free' ? ' on the free tier: only use public-domain or openly licensed pages.' : '.'}
			</p>
		{/if}
	</header>

	<label class="btn open">
		Open a page (image or PDF)
		<input class="visually-hidden" type="file" aria-label="Open a comic page" accept="image/png,image/jpeg,image/webp,application/pdf"
			onchange={(e) => open(e.currentTarget.files?.[0])} />
	</label>
	{#if error}<p role="alert">{error}</p>{/if}

	{#if book && current}
		<nav class="pager" aria-label="Pages">
			<button class="btn" disabled={index === 0} onclick={() => show(index - 1)}>Previous page</button>
			<p class="mono">Page {index + 1} of {book.count}</p>
			<button class="btn" disabled={index === book.count - 1} onclick={() => show(index + 1)}>Next page</button>
		</nav>

		<div class="sides">
			<figure>
				<figcaption class="mono">Original (stays on your device) · drag to mark each piece of English</figcaption>
				<div class="stage" role="img" aria-label="Original page">
					<canvas bind:this={original}></canvas>
					<svg data-testid="draw-layer" viewBox="0 0 {current.width} {current.height}" aria-hidden="true"
						onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={() => (drag = null)}>
						{#each regions as r, i (r.id)}
							<rect x={r.box.x} y={r.box.y} width={r.box.w} height={r.box.h} class:flag={r.problem} />
							<text x={r.box.x + 6} y={r.box.y + 30}>{i + 1}</text>
						{/each}
						{#if drag}<rect class="drag" x={drag.box.x} y={drag.box.y} width={drag.box.w} height={drag.box.h} />{/if}
					</svg>
				</div>
			</figure>
			<figure>
				<figcaption class="mono">Burmese</figcaption>
				<div class="stage" role="img" aria-label="Burmese page" data-rendered={rendered}><canvas bind:this={burmeseCanvas}></canvas></div>
				<button class="btn" disabled={!rendered} onclick={download}>Download PNG</button>
			</figure>
		</div>

		<div class="below">
			<section aria-labelledby="boxes-h">
				<h2 id="boxes-h" class="mono">Boxes</h2>
				{#if !regions.length}<p class="soft">No boxes yet. Drag over each piece of English on the original.</p>{/if}
				<ol class="regions">
					{#each regions as r, i (r.id)}
						<li class:flagged={r.problem}>
							<span class="num mono">{i + 1}</span>
							<label>Kind <select bind:value={r.cls}>{#each CLASSES as c (c)}<option value={c}>{c}</option>{/each}</select></label>
							<label>Speaker <select bind:value={r.speaker}>{#each SPEAKERS as s (s)}<option value={s}>{s}</option>{/each}</select></label>
							<label class="wide">English <input bind:value={r.english} /></label>
							<label class="wide">Burmese <input lang="my" class="my" bind:value={r.burmese} oninput={() => (r.problem = null)} /></label>
							{#if r.problem}<p class="problem">{PROBLEMS[r.problem]}</p>{/if}
							<button class="btn" aria-label="Delete box {i + 1}" onclick={() => remove(r.id)}>Delete</button>
						</li>
					{/each}
				</ol>
				<div class="actions">
					<button class="btn" disabled={busy || !sent.length} onclick={() => translate()}>Translate page</button>
					{#if regions.some((r) => r.problem)}
						<button class="btn" disabled={busy} onclick={() => translate(true)}>Retry flagged lines</button>
					{/if}
				</div>
			</section>
			<section class="sent" aria-labelledby="sent-h">
				<h2 id="sent-h" class="mono">Sent to Gemini (text only)</h2>
				<pre>{sent.map((l) => `${l.n} [${l.speaker}] ${l.text}`).join('\n') || 'Nothing yet.'}</pre>
			</section>
		</div>
	{/if}
</div>

<style>
	.comic { max-width: var(--max); margin: 0 auto; padding: var(--space-4) var(--gutter); display: grid; gap: var(--space-3); }
	.head { display: grid; gap: var(--space-1); }
	h1 { font-size: var(--step-3); }
	.open { justify-self: start; }
	.pager { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
	.sides { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: var(--space-3); }
	figure { margin: 0; display: grid; gap: var(--space-1); }
	.stage { position: relative; border: 1px solid var(--hairline); }
	canvas { display: block; width: 100%; height: auto; }
	svg { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
	rect { fill: none; stroke: var(--red); stroke-width: 4; vector-effect: non-scaling-stroke; }
	rect.drag { stroke-dasharray: 6 4; }
	rect.flag { stroke: var(--amber); }
	svg text { fill: var(--red); font: 600 28px var(--font-mono); }
	.below { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: var(--space-3); align-items: start; }
	.regions { list-style: none; padding: 0; margin: var(--space-2) 0; display: grid; gap: var(--space-2); }
	.regions li { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-2); align-items: end; padding: var(--space-2); border: 1px solid var(--hairline); border-radius: var(--radius); }
	.regions li.flagged { border-color: var(--red); }
	.regions label { display: grid; gap: 2px; font-size: var(--step--1); }
	.regions .wide { flex: 1 1 14rem; }
	.regions input, .regions select { min-width: 0; padding: 0.3em 0.4em; border: 1px solid var(--hairline); border-radius: var(--radius); background: var(--plate); }
	.my { font-family: 'Noto Sans Myanmar', var(--font-sans); }
	.num { font-weight: 600; color: var(--red); }
	.problem { flex-basis: 100%; color: var(--red); }
	.actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
	.sent pre { margin: var(--space-2) 0 0; padding: var(--space-2); white-space: pre-wrap; overflow-wrap: anywhere; font: var(--step--1) var(--font-mono);
		background: light-dark(#fff7e0, #2e2614); border: 1px solid var(--amber); border-radius: var(--radius); }
	[role='alert'] { color: var(--red); }
</style>
