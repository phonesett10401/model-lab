<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { CHAT_MODEL, QUERY_CHARS, QUERY_PREFIX, TOP_K, VERSIONS, versionFrom, type Role, type Version } from '$lib/assistant/config';
	import { ANSWER_FAILED, OUT_OF_MEMORY, checkGpu, explainError, webllmEngine, type AssistantEngine, type GpuLike } from '$lib/assistant/engine';
	import { buildMessages, toMarkdown, topK, type Item, type Turn } from '$lib/assistant/rag';

	let { data } = $props();

	// Not called `state`: that name would clash with the $state rune.
	let phase = $state<'idle' | 'loading' | 'ready' | 'busy' | 'error'>('idle');
	let version = $state<Version | null>(null); // set once hydrated, so Start can't be clicked before it works
	let role = $state<Role>('student');
	let items = $state<Item[]>([]);
	let question = $state('');
	let progress = $state(0);
	let progressText = $state('');
	let message = $state('');
	let canRetry = $state(false);

	let box = $state<HTMLTextAreaElement>();
	let engine: AssistantEngine | undefined;
	let vectors: number[][] = [];

	onMount(() => (version = versionFrom(new URLSearchParams(location.search).get('version'))));

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
			vectors = await engine.embed(data.passages.map((p) => `${p.title}\n${p.text}`));
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
			const [qv] = await engine.embed([QUERY_PREFIX + q.slice(0, QUERY_CHARS)]);
			const hits = topK(qv, vectors, TOP_K).map((i) => data.passages[i]);
			const reply = await engine.chat(buildMessages(role, hits, history, q));
			items.push({ role: 'assistant', text: reply, sources: [...new Set(hits.map((h) => h.docId))] });
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
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([toMarkdown({ version: version!, role, date: now, items })], { type: 'text/markdown' }));
		a.download = `raffel-luo-${version}-${role}-${now.toISOString().slice(0, 16).replace(':', '-')}.md`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}
</script>

<svelte:head>
	<title>University of Raffel Luo assistant · AI Model Lab</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="page assistant" data-state={phase} data-version={version}>
	<a class="back mono" href="/">← AI Model Lab</a>
	<h1 class="serif">University of Raffel Luo assistant</h1>
	<p class="notice">Fictional university and data. A research test system. Runs only on your device.</p>
	{#if version}<p class="mono faint">Version {version}: {VERSIONS[version]} · {CHAT_MODEL}</p>{/if}

	<fieldset class="roles" disabled={phase === 'busy'}>
		<legend class="mono">Signed in as</legend>
		<label><input type="radio" name="role" value="student" bind:group={role} onchange={() => (items = [])} /> Student</label>
		<label><input type="radio" name="role" value="staff" bind:group={role} onchange={() => (items = [])} /> Staff</label>
	</fieldset>
	<p class="mono faint">Not a real sign-in. Switching starts a new conversation.</p>

	{#if phase === 'idle'}
		<div class="start">
			<button class="btn" onclick={start} disabled={!version}>Start the assistant</button>
			<p class="mono faint">Downloads about 1 GB the first time, then it’s kept on this device.</p>
		</div>
	{:else if phase === 'loading'}
		<div class="start">
			<p class="mono">Loading the assistant · only the first time is slow</p>
			<progress max="1" value={progress} aria-label="Download progress"></progress>
			<p class="mono faint">{progressText}</p>
		</div>
	{:else if phase === 'error'}
		<div class="start">
			<p class="note" role="alert">{message}</p>
			{#if canRetry}<button class="btn" onclick={start}>Try again</button>{/if}
		</div>
	{:else}
		<ol class="log" aria-live="polite">
			{#each items as item, i (i)}
				<li data-role={item.role} data-sources={item.role === 'assistant' ? (item.sources ?? []).join(',') : undefined}>
					<span class="who mono">{item.role === 'user' ? 'You' : item.role === 'assistant' ? 'Assistant' : 'Error'}</span>
					<p class="text">{item.text}</p>
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
	{/if}
</article>

<style>
	.page { max-width: 46rem; margin: 0 auto; padding: var(--space-3) var(--gutter); display: grid; gap: var(--space-2); }
	.back { min-height: 44px; display: inline-flex; align-items: center; justify-self: start; }
	.notice { border-left: 3px solid var(--red); padding-left: var(--space-2); }
	.roles { display: flex; flex-wrap: wrap; gap: var(--space-2); border: 0; padding: 0; margin: 0; }
	.roles legend { padding: 0; margin-bottom: 0.25rem; }
	.roles label { min-height: 44px; display: inline-flex; align-items: center; gap: 0.4rem; }
	.start { display: grid; gap: var(--space-1); justify-items: start; }
	progress { width: 100%; accent-color: var(--ink); }
	.log { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
	.log li { display: grid; gap: 0.2rem; min-width: 0; }
	.log li[data-role='user'] { justify-self: end; max-width: 85%; background: var(--plate); padding: var(--space-1) var(--space-2); }
	.log li[data-role='error'] .text { color: var(--red); }
	.text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
	.ask { display: grid; gap: var(--space-1); }
	.ask textarea { width: 100%; min-width: 0; box-sizing: border-box; padding: var(--space-1); resize: vertical; }
	.ask button { justify-self: end; }
	.actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
</style>
