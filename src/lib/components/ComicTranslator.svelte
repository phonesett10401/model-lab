<script lang="ts">
	import { onMount } from 'svelte';
	import { applyRepair, checkLines } from '$lib/comic/check';
	import { serviceInfo, translateLines } from '$lib/comic/client';
	import { latestOnly, loadFiles, type Pages } from '$lib/comic/load';
	import { readingOrder } from '$lib/comic/order';
	import { renderPage } from '$lib/comic/render';
	import { comicDetector, MODEL_MB } from '$lib/comic/detect';
	import { loadOcr, looksEnglish, OCR_MB, readBox } from '$lib/comic/ocr';
	import { ENGINE_MB } from '$lib/runtime/engine';
	import '@fontsource/noto-sans-myanmar/400.css';
	import type { Box, LineProblem, Region, RegionClass, SentLine, Speaker } from '$lib/comic/types';

	const CLASSES: RegionClass[] = ['bubble', 'caption', 'sfx', 'art-text'];
	const SPEAKERS: Speaker[] = ['unknown', 'man', 'woman', 'child', 'narrator'];
	const PROBLEMS: Record<LineProblem, string> = {
		missing: 'Didn’t come back. Retry or type your own.',
		'not-burmese': 'Didn’t come back in Burmese. Retry or type your own.',
		zawgyi: 'Came back in Zawgyi, not Unicode. Retry or type your own.',
		length: 'The length looks off. Check it, retry or type your own.',
		unread: 'Couldn’t read this. Type the English.',
		blocked: 'Gemini wouldn’t translate this line. Type the Burmese.'
	};
	const AUTO_MB = Math.round(MODEL_MB + ENGINE_MB + OCR_MB);

	let error = $state('');
	let info = $state<{ model: string; fallback?: string; tier: 'free' | 'paid' } | null>(null);
	/** Per page, the model Gemini says translated it (Flash first, Flash Lite once Flash's daily quota is used up). */
	let models = $state<string[]>([]);
	/** The server didn't say which tier: assume the free one, so its warning still shows. */
	let infoFailed = $state(false);
	/** The page an automatic run stopped on after a failed translation, so it can continue from there. */
	let stoppedAt = $state<number | null>(null);
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
	let rtl = $state(false);
	/** Automatic boxes: the detector finds the text, the OCR reads it, both on this device. */
	let auto = $state<'idle' | 'loading' | 'reading' | 'translating' | 'done'>('idle');
	/** Find and translate every page as soon as files are chosen. */
	let autoOn = $state(true);
	/** Bumped by each new set of files, so an older run stops. */
	let run = 0;
	let autoProgress = $state<number | null>(null);
	let autoStatus = $state('');
	let autoError = $state('');
	let ocrReady = false;

	/** True from the first page to the last of an automatic run, so nothing reads as finished in between. */
	let running = $state(false);
	const working = $derived(running || auto === 'loading' || auto === 'reading' || auto === 'translating');
	const regions = $derived(readingOrder(byPage[index] ?? [], rtl));
	const sent = $derived<SentLine[]>(
		regions.map((r, i) => ({ n: i + 1, text: r.english.trim(), cls: r.cls, speaker: r.speaker })).filter((l) => l.text)
	);

	onMount(async () => {
		info = await serviceInfo();
		infoFailed = !info;
	});

	const OPEN_FAILED = 'That file couldn’t be opened. Try again.';
	const latest = latestOnly();

	async function open(files: File[]) {
		if (!files.length) return;
		error = '';
		const mine = ++run;
		// The old run is cancelled: unlock the page now, as its own ending won't (it no longer owns `running`).
		running = false;
		auto = 'idle';
		stoppedAt = null;
		resetAuto(); // at once, so the last file's "done" never stands for this one
		let pages: Pages;
		try {
			pages = await loadFiles(files);
		} catch {
			error = OPEN_FAILED;
			return;
		}
		if (!pages.ok) {
			error = pages.reason;
			return;
		}
		book?.destroy();
		book = pages;
		resetAuto();
		byPage = Array.from({ length: pages.count }, () => []);
		models = [];
		await show(0);
		if (autoOn) await translateAll(mine, 0);
	}

	/** Finds, reads and translates each page in turn (one Gemini request per page), then goes back to the first. */
	async function translateAll(mine: number, from: number) {
		if (!book) return;
		running = true;
		try {
			await eachPage(mine, from, book.count);
		} finally {
			if (mine === run) running = false;
		}
	}

	async function eachPage(mine: number, from: number, count: number) {
		for (let i = from; i < count; i++) {
			if (i !== index) await show(i);
			if (mine !== run) return;
			const prefix = count > 1 ? `Page ${i + 1} of ${count}: ` : '';
			// Continuing after a failed translation: that page's boxes are already there.
			const found = byPage[i]?.length ? 'found' : await findText(prefix);
			if (mine !== run || found === 'failed' || found === 'gone') return;
			if (sent.length) {
				auto = 'translating';
				autoStatus = `${prefix}Translating…`;
				const ok = await translate();
				if (mine !== run) return;
				auto = 'done';
				if (!ok) { autoStatus = ''; stoppedAt = i; return; }
				if (count === 1) autoStatus = `Found and translated ${regions.length} pieces of English. Check them below.`;
			}
		}
		if (count > 1) {
			await show(0);
			auto = 'done';
			autoStatus = `Finished all ${count} pages. Check each one; fix any line and press Translate page.`;
		}
	}

	/** Only the newest page request wins, so fast clicks can't put one page's boxes on another page's art. */
	function resetAuto() {
		if (auto !== 'loading' && auto !== 'reading' && auto !== 'translating') auto = 'idle';
		autoStatus = '';
		autoError = '';
	}

	async function show(i: number) {
		if (!book) return;
		try {
			const bmp = await latest(book.page(i));
			if (!bmp) return;
			current?.close();
			index = i;
			current = bmp;
			resetAuto();
		} catch {
			error = OPEN_FAILED;
		}
	}

	$effect(() => {
		if (!original || !current) return;
		original.width = current.width;
		original.height = current.height;
		original.getContext('2d')!.drawImage(current, 0, 0);
	});

	let rendered = $state(false);
	/** How each box's Burmese was lettered: fitted, grown inside the page, or on a covering box. */
	let modes = $state<Record<number, 'fit' | 'grown' | 'cover'>>({});
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
		renderPage(off.getContext('2d', { willReadFrequently: true })!, page, snap).then((done) => {
			if (token !== renderToken || !burmeseCanvas) return;
			burmeseCanvas.width = page.width;
			burmeseCanvas.height = page.height;
			burmeseCanvas.getContext('2d')!.drawImage(off, 0, 0);
			rendered = snap.some((r) => r.burmese.trim());
			modes = done.modes;
		}).catch(() => {
			// A stale render can hit a page bitmap that was just closed; only the current one matters.
			if (token === renderToken) error = 'Couldn’t draw the Burmese page. Try again.';
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
		if (drag && drag.box.w >= 8 && drag.box.h >= 8) {
			byPage[index].push({ id: nextId++, box: drag.box, cls: 'bubble', speaker: 'unknown', english: '', burmese: '', problem: null, ocr: '', edited: false });
			// Once the reader is loaded, a box drawn by hand is read too.
			if (ocrReady && current) read(byPage[index].at(-1)!, current);
		}
		drag = null;
	}

	/** Fills one row from the OCR; a box it can't read asks the visitor to type the English. */
	async function read(r: Region, page: ImageBitmap) {
		const { text, conf } = await readBox(page, r.box);
		if (r.edited) return;
		if (looksEnglish(text, conf)) {
			r.english = text;
			r.ocr = text;
			r.problem = null;
		} else r.problem = 'unread';
	}

	async function findText(prefix = ''): Promise<'found' | 'none' | 'failed' | 'gone'> {
		if (!current) return 'gone';
		autoError = '';
		autoStatus = `${prefix}Downloading the text finder…`;
		auto = 'loading';
		autoProgress = 0;
		const detector = comicDetector();
		try {
			await Promise.all([detector.load((p) => (autoProgress = p)), loadOcr()]);
			ocrReady = true;
		} catch {
			auto = 'idle';
			autoStatus = '';
			autoError = 'Couldn’t download the text finder. Check the connection and try again.';
			return 'failed';
		}
		auto = 'reading';
		autoStatus = `${prefix}Looking for English…`;
		const page = current, at = index;
		/** The visitor moved to another page: stop quietly and leave the finder ready again. */
		const gone = () => {
			if (page === current) return false;
			auto = 'idle';
			autoStatus = '';
			return true;
		};
		try {
			const found = await detector.detect(page);
			if (gone()) return 'gone';
			if (!found.length) {
				auto = 'done';
				autoStatus = `${prefix}No English found. Draw boxes by hand.`;
				return 'none';
			}
			const ids = found.map(() => nextId++);
			byPage[at] = [...byPage[at], ...found.map((d, i) => ({ id: ids[i], box: d.box, cls: d.cls, speaker: 'unknown' as Speaker,
				english: '', burmese: '', problem: null, ocr: '', edited: false }))];
			for (const [i, id] of ids.entries()) {
				if (gone()) return 'gone';
				autoStatus = `${prefix}Reading box ${i + 1} of ${ids.length}…`;
				const r = byPage[at].find((x) => x.id === id);
				if (r) await read(r, page);
			}
			// A found box nobody can read is almost always a sound effect or a scribble: leave it as drawn rather than
			// ask for typing. (A box drawn by hand still asks.)
			const dropped = new Set(ids.filter((id) => byPage[at].find((x) => x.id === id)?.problem === 'unread'));
			byPage[at] = byPage[at].filter((x) => !dropped.has(x.id));
			const kept = ids.length - dropped.size;
			auto = 'done';
			if (!kept) {
				autoStatus = `${prefix}No English found. Draw boxes by hand.`;
				return 'none';
			}
			autoStatus = `${prefix}Found ${kept} pieces of English. Check them below.`;
			return 'found';
		} catch {
			if (gone()) return 'gone'; // a page released mid-read: nothing to report
			auto = 'idle';
			autoStatus = '';
			autoError = 'Couldn’t read this page. Try again.';
			return 'failed';
		}
	}
	function remove(id: number) {
		byPage[index] = byPage[index].filter((r) => r.id !== id);
	}

	/** Sends the page's text. With onlyFlagged, every line is sent again for context but only flagged rows change. */
	async function translate(onlyFlagged = false): Promise<boolean> {
		if (!sent.length) return false;
		busy = true;
		error = '';
		const lines = sent;
		const order = regions, at = index;
		const reply = await translateLines(lines);
		busy = false;
		if (!reply.ok) {
			error = reply.error === 'quota' ? 'Today’s translations are used up. Try again tomorrow.'
				: reply.error === 'busy' ? 'Busy right now. Try again in a minute.'
				: reply.error === 'blocked' ? 'Gemini wouldn’t translate this page. Type the Burmese.'
				: 'Translation failed. Try again in a moment.';
			return false;
		}
		if (reply.model) models[at] = reply.model;
		const refused = new Set(reply.blocked ?? []);
		const { byN } = checkLines(lines, reply.lines);
		const english = new Map(reply.lines.map((g) => [g.n, g]));
		for (const l of lines) {
			const r = order[l.n - 1];
			if (onlyFlagged && !r.problem) continue;
			const got = byN.get(l.n)!;
			r.burmese = got.text || r.burmese;
			r.problem = refused.has(l.n) ? 'blocked' : got.problem;
			const fixed = english.get(l.n);
			if (fixed) r.english = applyRepair(r, fixed).english;
		}
		return true;
	}
</script>

<div class="comic" data-auto={running ? 'running' : auto} data-model={models[index] ?? ''}>
	<header class="head">
		<h1 class="serif">Comic translator</h1>
		<p><a href="/models/comic-translator">How well it works →</a></p>
		<p class="soft">English to Burmese. Your pages stay on your device; only the English words are sent to be translated.</p>
		{#if info || infoFailed}
			<p class="mono tier">
				Translating{info ? ` with ${info.model}` : ''}{info?.fallback ? ` (then ${info.fallback} once its free daily quota is used up)` : ''}{info?.tier === 'paid' ? '.' : ' on the free tier: only use public-domain or openly licensed pages.'}
			</p>
		{/if}
	</header>

	<section class="setup" aria-label="Before you choose">
		<label class="check"><input type="checkbox" bind:checked={autoOn} /> Find and translate automatically</label>
		<label class="check"><input type="checkbox" bind:checked={rtl} /> Manga order (right to left)</label>
		<p class="mono soft">Finding the text downloads about {AUTO_MB} MB once and runs on your device: your pictures are never sent anywhere.</p>
	</section>

	<label class="btn open">
		Select pictures or files to translate
		<input class="visually-hidden" type="file" multiple aria-label="Select pictures or files to translate" accept="image/png,image/jpeg,image/webp,application/pdf"
			onchange={(e) => open([...(e.currentTarget.files ?? [])])} />
	</label>
	{#if error}<p role="alert">{error}</p>{/if}

	{#if book && current}
		<nav class="pager" aria-label="Pages">
			<button class="btn" disabled={index === 0 || working} onclick={() => show(index - 1)}>Previous page</button>
			<p class="mono">Page {index + 1} of {book.count}</p>
			<button class="btn" disabled={index === book.count - 1 || working} onclick={() => show(index + 1)}>Next page</button>
		</nav>

		<section class="auto" aria-label="Find the text automatically">
			{#if !autoOn || autoError}
				<button class="btn" disabled={working} onclick={() => (autoOn && autoError ? translateAll(run, index) : findText())}>
					{autoError ? 'Try again' : 'Find the text for me'}
				</button>
			{/if}
			{#if auto === 'loading'}<progress max="1" value={autoProgress} aria-label="Text finder download"></progress>{/if}
			{#if stoppedAt !== null && !working}
				<button class="btn" onclick={() => { const from = stoppedAt!; stoppedAt = null; error = ''; translateAll(run, from); }}>
					Continue from page {stoppedAt + 1}
				</button>
			{/if}
			<p class="mono" role="status">{autoStatus}</p>
			{#if autoError}<p role="alert">{autoError}</p>{/if}
		</section>

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
						<li class:flagged={r.problem} data-x={Math.round(r.box.x)} data-box={[r.box.x, r.box.y, r.box.w, r.box.h].map(Math.round).join(',')}
							data-ocr={r.ocr} data-mode={modes[r.id] ?? ''}>
							<span class="num mono">{i + 1}</span>
							<label>Kind <select bind:value={r.cls}>{#each CLASSES as c (c)}<option value={c}>{c}</option>{/each}</select></label>
							<label>Speaker <select bind:value={r.speaker}>{#each SPEAKERS as s (s)}<option value={s}>{s}</option>{/each}</select></label>
							<label class="wide">English <input bind:value={r.english} oninput={() => { r.edited = true; if (r.problem === 'unread') r.problem = null; }} /></label>
							{#if r.ocr && r.ocr !== r.english}<p class="ocr mono soft">OCR read: {r.ocr}</p>{/if}
							<label class="wide">Burmese <input lang="my" class="my" bind:value={r.burmese} oninput={() => (r.problem = null)} /></label>
							{#if r.problem}<p class="problem">{PROBLEMS[r.problem]}</p>{/if}
							<button class="btn" aria-label="Delete box {i + 1}" onclick={() => remove(r.id)}>Delete</button>
						</li>
					{/each}
				</ol>
				<div class="actions">
					<button class="btn" disabled={busy || working || !sent.length} onclick={() => translate()}>Translate page</button>
					{#if regions.some((r) => r.problem)}
						<button class="btn" disabled={busy} onclick={() => translate(true)}>Retry flagged lines</button>
					{/if}
					{#if models[index]}<p class="mono soft">Translated by {models[index]}</p>{/if}
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
	/* The real input is visually hidden, so its keyboard focus shows on the button-like label. */
	.open:has(input:focus-visible) { outline: 2px solid var(--red); outline-offset: 3px; }
	.setup { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); }
	.setup p { flex-basis: 100%; }
	.auto { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); }
	.auto progress { flex: 1 1 12rem; }
	.auto [role='status'] { flex-basis: 100%; min-height: 1.5em; }
	.check { display: inline-flex; align-items: center; gap: 0.5em; min-height: 44px; }
	.check input { width: 1.2em; height: 1.2em; }
	.ocr { flex-basis: 100%; font-size: var(--step--1); }
	.pager { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
	.sides { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: var(--space-3); }
	/* align-content: start, or the shorter column stretches its rows to match the one with the Download button. */
	figure { margin: 0; display: grid; gap: var(--space-1); align-content: start; }
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
