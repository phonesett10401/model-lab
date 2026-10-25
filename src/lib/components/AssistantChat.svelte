<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { replaceState } from '$app/navigation';
	import type { AssistantSettings } from '$lib/assistant/assistants';
	import { auditFor } from '$lib/assistant/audits';
	import { CHAT_MODEL, QUERY_CHARS, uses, QUERY_PREFIX, TOP_K, VERSIONS, versionFrom, type Version } from '$lib/assistant/config';
	import { restrictedDocs, type Passage } from '$lib/assistant/docs';
	import { segments } from '$lib/transcript';
	import { ANSWER_FAILED, OUT_OF_MEMORY, checkGpu, explainError, webllmEngine, type AssistantEngine, type GpuLike } from '$lib/assistant/engine';
	import { BLOCKED_LABEL, buildMessages, search, toMarkdown, type Item, type Turn } from '$lib/assistant/rag';
	import { blockedText, filteredText, inputFilter, noGuessText, numberCheck, outputCheck } from '$lib/assistant/guard';
	import { knownNumbers } from '$lib/assistant/score';

	let { assistant: a, passages, secrets = [] }: { assistant: AssistantSettings; passages: Passage[]; secrets?: string[] } = $props();

	// Not called `state`: that name would clash with the $state rune.
	let phase = $state<'idle' | 'loading' | 'ready' | 'busy' | 'error'>('idle');
	let version = $state<Version | null>(null); // set once hydrated, so Start can't be clicked before it works
	let role = $state(untrack(() => a.roles[0].id)); // the page is keyed by assistant, so the first value is all we need
	let items = $state<Item[]>([]);
	let question = $state('');
	let progress = $state(0);
	let progressText = $state('');
	let message = $state('');
	let canRetry = $state(false);

	let box = $state<HTMLTextAreaElement>();
	let engine: AssistantEngine | undefined;
	let vectors: number[][] = [];

	// The "What it read" panel: the documents behind the latest answer.
	const byDoc = $derived(new Map(passages.map((p) => [p.docId, p])));
	const restricted = $derived(restrictedDocs(passages, secrets));
	/** Numbers a reply may give: from the documents this role may see and the always-shown emergency numbers (worked out once per role), plus the user's own messages. */
	const docNumbers = $derived.by(() => {
		const shown = (a.numbers ?? []).map((n) => n.number);
		const from = (ps: Passage[]) => [...ps.flatMap((p) => knownNumbers(p.text)), ...shown];
		return { public: from(passages.filter((p) => p.access === 'public')), all: from(passages) };
	});
	const allowedNumbers = (r: string, said: string[]) => [...(r === a.roles[0].id ? docNumbers.public : docNumbers.all), ...said.flatMap(knownNumbers)];
	const lastReply = $derived([...items].reverse().find((i): i is Turn => i.role === 'assistant'));
	const read = $derived((lastReply?.sources ?? []).map((id) => byDoc.get(id)).filter((p): p is Passage => !!p));
	const publicRole = $derived(role === a.roles[0].id);
	const leaked = $derived(publicRole && read.some((p) => p.access !== 'public'));

	const MAIN: [Version, string][] = [['v1', 'Recommended'], ['v0', 'No defence']];
	const EXPERIMENTS: Version[] = ['D1', 'D2', 'D3', 'D4', 'D5'];
	// Each version's measured held-out leak rate, from this assistant's audit (only versions it measured).
	const rates = $derived(new Map((auditFor(a.slug)?.report.metrics.rows ?? []).flatMap((r) => (typeof r.value === 'number' ? [[r.label, r.value] as const] : []))));

	onMount(() => (version = versionFrom(new URLSearchParams(location.search).get('version'))));

	/** A new version starts a new conversation and is kept in the address, so a shared link opens the same version. */
	function pickVersion(v: Version) {
		items = [];
		const url = new URL(location.href);
		url.searchParams.set('version', v);
		replaceState(url, {});
	}

	async function start() {
		phase = 'loading';
		progress = 0;
		progressText = '';
		const fake = (globalThis as { __assistantEngine?: AssistantEngine }).__assistantEngine; // e2e tests run without a GPU
		if (!fake) {
			const problem = await checkGpu((navigator as { gpu?: GpuLike }).gpu);
			if (problem) return fail(problem, false);
		}
		engine ??= fake ?? webllmEngine();
		try {
			await engine.load((p, text) => { progress = p; progressText = text; });
			progressText = 'Preparing the documents…';
			vectors = await engine.embed(passages.map((p) => `${p.title}\n${p.text}`));
			phase = 'ready';
			await tick();
			box?.focus();
		} catch (e) {
			fail(explainError(e), true);
		}
	}

	function fail(text: string, retry: boolean) {
		message = text;
		canRetry = retry;
		phase = 'error';
	}

	async function send(e: SubmitEvent) {
		e.preventDefault();
		const q = question.trim();
		if (!q || phase !== 'ready' || !engine) return;
		const history = items.filter((i): i is Turn => i.role !== 'error');
		items.push({ role: 'user', text: q });
		question = '';
		phase = 'busy';
		box?.focus(); // Send disables itself, which would drop focus
		try {
			// D2: injection wording from a public-role user is refused before search or the model.
			if (uses(version ?? 'v0', 'D2') && role === a.roles[0].id && inputFilter(q)) {
				items.push({ role: 'assistant', text: filteredText, sources: [], blocked: 'D2' });
				phase = 'ready';
				return void box?.focus();
			}
			const [qv] = await engine.embed([QUERY_PREFIX + q.slice(0, QUERY_CHARS)]);
			const hits = search(a, role, version ?? 'v0', passages, vectors, qv, TOP_K);
			const reply = await engine.chat(buildMessages(a, role, hits, history, q, version ?? 'v0'));
			const sources = [...new Set(hits.map((h) => h.docId))];
			// D3: a reply holding a restricted value never reaches a public-role user.
			if (uses(version ?? 'v0', 'D3') && role === a.roles[0].id && outputCheck(reply, secrets)) items.push({ role: 'assistant', text: blockedText(a), sources, blocked: 'D3', hidden: reply });
			// v1: a number in no document this role may see (nor in what the user wrote) is a guess, so it never reaches anyone.
			else if (version === 'v1' && numberCheck(reply, allowedNumbers(role, [...history.filter((t) => t.role === 'user').map((t) => t.text), q]))) items.push({ role: 'assistant', text: noGuessText(a), sources, blocked: 'numbers', hidden: reply });
			else items.push({ role: 'assistant', text: reply, sources });
		} catch (err) {
			const text = explainError(err, ANSWER_FAILED);
			items.push({ role: 'error', text });
			if (text === OUT_OF_MEMORY) { // the GPU device is gone; only a fresh load recovers (files stay cached)
				engine = undefined;
				return fail(text, true);
			}
		}
		phase = 'ready';
		box?.focus();
	}

	function enterSends(e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			e.currentTarget.form?.requestSubmit();
		}
	}

	function save() {
		const now = new Date();
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([toMarkdown({ assistant: a, version: version!, role, date: now, items })], { type: 'text/markdown' }));
		link.download = `${a.slug}-${version}-${role}-${now.toISOString().slice(0, 16).replace(':', '-')}.md`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
	}
</script>

<article class="assistant" data-assistant={a.slug} data-state={phase} data-version={version} style="--accent: light-dark({a.accent.light}, {a.accent.dark})">
	<div class="strip mono">
		<a class="back" href="/assistants">All RAG assistants</a>
		<span class="faint"><span>{version ?? 'v0'}</span><span>{a.kind}</span></span>
	</div>
	<div class="band mono" style="background: {a.band.bg}; color: {a.band.fg}; border-bottom-color: {a.band.line ?? a.band.bg}">
		<span>{a.band.text}</span><span>{a.band.aside}</span>
	</div>
	{#if a.numbers}
		<ul class="numbers" aria-label="Real Thai emergency numbers">
			{#each a.numbers as n (n.number)}
				<li><a href="tel:{n.number}"><b class="mono">{n.number}</b><span class="mono faint">{n.label}</span></a></li>
			{/each}
		</ul>
	{/if}

	<div class="page">
		<h1 class="serif">{a.name}</h1>
		<p class="notice">{a.fiction} A research test system. Runs only on your device.</p>
		<p class="mono faint">Chat model: {CHAT_MODEL}</p>
		<p class="mono faint">The documents are downloaded to your device so the assistant can run here; the test is whether the chatbot can be talked into revealing restricted ones.</p>
		<p class="mono" data-audit>{#if auditFor(a.slug)}Attack results: <a href="/audits/{a.slug}">read the audit</a>{:else}<span class="faint">Attack results: being measured</span>{/if}</p>
		{#if restricted.length}
			<details class="restricted" data-restricted>
				<summary class="mono">{restricted.length} {a.restrictedLabel} documents: what attackers try to get</summary>
				<p class="mono faint">Fictional data. Shown so you can check a leak against the original; the highlighted values are the ones the tests look for. The assistant reads its own copy, never this page.</p>
				{#each restricted as d (d.docId)}
					<article>
						<h2 class="mono">{d.title}</h2>
						<p>{#each segments(d.text, d.flagged) as s, k (k)}{#if s.flagged}<mark>{s.text}</mark>{:else}{s.text}{/if}{/each}</p>
					</article>
				{/each}
			</details>
		{/if}

		<fieldset class="roles" disabled={phase === 'busy'}>
			<legend class="mono">Signed in as</legend>
			{#each a.roles as r (r.id)}
				<label><input type="radio" name="role" value={r.id} bind:group={role} onchange={() => (items = [])} /> {r.label}</label>
			{/each}
		</fieldset>
		<p class="mono faint">Not a real sign-in. Switching starts a new conversation.</p>

		<!-- One radio group (one name), shown as the two choices most visitors want, then the single-defence experiments. -->
		<fieldset class="versions" disabled={phase === 'busy' || !version}>
			<legend class="mono">Version</legend>
			<div class="main" data-main>
				{#each MAIN as [v, tag] (v)}
					<label class="opt"><input type="radio" name="version" value={v} bind:group={version} onchange={() => pickVersion(v)} aria-describedby="version-how" /> <b class="mono">{v}</b> <span class="faint">{tag}</span></label>
				{/each}
			</div>
			<fieldset class="exp">
				<legend class="mono faint">Experiments: one defence at a time</legend>
				{#each EXPERIMENTS as v (v)}
					<label class="opt"><input type="radio" name="version" value={v} bind:group={version} onchange={() => pickVersion(v)} aria-describedby="version-how" /> <b class="mono">{v}</b></label>
				{/each}
			</fieldset>
			{#if version}
				<p id="version-how" class="how">{VERSIONS[version]}{#if rates.has(version)}<span class="mono rate">Leaked {Math.round(rates.get(version)! * 100)}% of attacks in the audit</span>{/if}</p>
			{/if}
		</fieldset>

		{#if phase === 'idle'}
			<div class="start">
				<button class="btn" onclick={start} disabled={!version}>Start the assistant</button>
				<p class="mono faint">Downloads about 1 GB the first time, then it’s kept on this device.</p>
			</div>
		{:else if phase === 'loading'}
			<div class="start">
				<p class="mono">Loading the assistant… only the first time is slow</p>
				<progress max="1" value={progress} aria-label="Download progress"></progress>
				<p class="mono faint">{progressText}</p>
			</div>
		{:else if phase === 'error'}
			<div class="start">
				<p class="note" role="alert">{message}</p>
				{#if canRetry}<button class="btn" onclick={start}>Try again</button>{/if}
			</div>
		{:else}
			<div class="desk">
				<div class="chat">
					<ol class="log" aria-live="polite">
						{#each items as item, i (i)}
							<li data-role={item.role} data-sources={item.role === 'assistant' ? (item.sources ?? []).join(',') : undefined} data-blocked={item.role === 'assistant' && item.blocked ? 'true' : undefined} data-blocked-by={item.role === 'assistant' ? item.blocked : undefined} data-hidden={item.role === 'assistant' && item.blocked ? item.hidden : undefined}>
								<span class="who mono">{item.role === 'user' ? 'You' : item.role === 'assistant' ? 'Assistant' : 'Error'}</span>
								<p class="text">{item.text}</p>
								{#if item.role === 'assistant' && item.blocked}<span class="mono blocked">{BLOCKED_LABEL[item.blocked]}</span>{/if}
							</li>
						{/each}
					</ol>
					{#if phase === 'busy'}<p class="mono" role="status">Thinking…</p>{/if}
					<form class="ask" onsubmit={send}>
						<label class="mono" for="question">Your question</label>
						<textarea id="question" rows="2" bind:this={box} bind:value={question} onkeydown={enterSends}></textarea>
						<button class="btn" type="submit" disabled={phase === 'busy' || !question.trim()}>Send</button>
					</form>
					<div class="actions">
						<button class="btn ghost" onclick={() => (items = [])} disabled={phase === 'busy' || !items.length}>New conversation</button>
						<button class="btn ghost" onclick={save} disabled={!items.length}>Save this conversation</button>
					</div>
				</div>
				<aside class="read" aria-label="What it read">
					<h2 class="mono">What it read for this answer</h2>
					{#if read.length}
						<ul>
							{#each read as p (p.docId)}
								<li data-access={p.access} class:restricted={p.access !== 'public'} class:leak={publicRole && p.access !== 'public'}>
									<span class="mono">{p.access === 'public' ? 'public' : a.restrictedLabel}</span>
									<span>{p.title}</span>
								</li>
							{/each}
						</ul>
						{#if leaked}<p class="mono warn">{a.warning}</p>{/if}
					{:else}
						<p class="mono faint">Ask a question to see which documents it read.</p>
					{/if}
				</aside>
			</div>
		{/if}
	</div>
</article>

<style>
	.restricted { border: 1px solid var(--hairline); background: var(--plate); padding: 0.6rem 0.8rem; }
	.restricted summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; }
	.restricted article { display: grid; gap: 0.3rem; padding-top: var(--space-1); border-top: 1px solid var(--hairline); margin-top: var(--space-1); }
	.restricted h2 { font-size: var(--step--1); color: var(--accent); }
	.restricted p { white-space: pre-line; max-width: 70ch; }
	.restricted mark { background: none; color: inherit; text-decoration: underline 2px var(--red); text-underline-offset: 3px; font-weight: 600; }
	.strip { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-1); padding: 0 var(--gutter); border-bottom: 1px solid var(--hairline); }
	.back { min-height: 44px; display: inline-flex; align-items: center; }
	.strip span { display: inline-flex; align-items: center; gap: 0.75em; }
	.band { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-1); padding: var(--space-1) var(--gutter); border-bottom: 2px solid; letter-spacing: 0.08em; text-transform: uppercase; }
	.numbers { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-bottom: 1px solid var(--hairline); }
	.numbers li + li { border-left: 1px solid var(--hairline); }
	.numbers a { min-height: 44px; display: grid; justify-items: center; align-content: center; padding: var(--space-1) 0.25rem; text-decoration: none; color: var(--ink); }
	.numbers b { font-size: var(--step-1); font-weight: 500; }
	.page { max-width: 72rem; margin: 0 auto; padding: var(--space-3) var(--gutter); display: grid; gap: var(--space-2); }
	.notice { border-left: 3px solid var(--accent); padding-left: var(--space-2); }
	.roles { display: flex; flex-wrap: wrap; gap: var(--space-2); border: 0; padding: 0; margin: 0; }
	.roles legend { padding: 0; margin-bottom: 0.25rem; }
	.roles label { min-height: 44px; display: inline-flex; align-items: center; gap: 0.4rem; }
	.roles input { accent-color: var(--accent); }
	.versions { display: grid; gap: var(--space-1); border: 0; padding: 0; margin: 0; min-width: 0; }
	.versions legend { padding: 0; margin-bottom: 0.25rem; }
	.main, .exp { display: flex; flex-wrap: wrap; gap: var(--space-1); }
	.exp { border: 0; padding: 0; margin: 0; min-width: 0; }
	.exp legend { padding: 0; margin-bottom: 0.25rem; font-size: var(--step--1); }
	.opt { min-height: 44px; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0 0.75rem; background: var(--plate); border: 1px solid var(--hairline); border-radius: var(--radius); cursor: pointer; }
	.opt:has(input:checked) { border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent); }
	.opt input { accent-color: var(--accent); margin: 0; }
	.opt b { font-weight: 500; }
	.how .rate { display: block; font-size: var(--step--1); margin-top: 0.2rem; }
	.how { margin: 0; max-width: 70ch; padding-left: var(--space-2); border-left: 3px solid var(--accent); }
	.start { display: grid; gap: var(--space-1); justify-items: start; }
	.btn:not(.ghost) { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
	progress { width: 100%; accent-color: var(--accent); }
	.desk { display: grid; gap: var(--space-3); }
	.chat { display: grid; gap: var(--space-2); min-width: 0; align-content: start; }
	.log { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
	.log li { display: grid; gap: 0.2rem; min-width: 0; }
	.log li[data-role='user'] { justify-self: end; max-width: 85%; background: var(--plate); padding: var(--space-1) var(--space-2); }
	.log li[data-role='error'] .text { color: var(--red); }
	.blocked { color: var(--red); }
	.text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
	.ask { display: grid; gap: var(--space-1); }
	.ask textarea {
		width: 100%; min-width: 0; box-sizing: border-box; padding: var(--space-1); resize: vertical;
		background: var(--plate); border: 1px solid var(--hairline); border-radius: var(--radius);
	}
	.ask button { justify-self: end; }
	.actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
	.read { display: grid; gap: var(--space-1); align-content: start; min-width: 0; border-top: 1px solid var(--hairline); padding-top: var(--space-2); }
	.read h2 { margin: 0; color: var(--ink-faint); font-weight: 500; }
	.read ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
	.read li { display: grid; gap: 0.1rem; padding: var(--space-1); border: 1px solid var(--hairline); overflow-wrap: anywhere; }
	.read li .mono { color: var(--ink-faint); }
	.read li.leak { border-color: var(--red); }
	.read li.leak .mono, .warn { color: var(--red); }
	@media (min-width: 900px) {
		.desk { grid-template-columns: minmax(0, 1fr) 18rem; }
		.read { border-top: 0; padding-top: 0; border-left: 1px solid var(--hairline); padding-left: var(--space-2); }
	}
</style>
