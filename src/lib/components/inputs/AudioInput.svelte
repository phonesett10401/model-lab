<script lang="ts">
	import { checkFile, MAX_RECORD_SECONDS, micErrorMessage } from '$lib/input-checks';
	import { waveform } from '$lib/waveform';
	import type { ModelInput } from '$lib/types';

	let {
		disabled, examining, shown = $bindable(null), onsubmit, onerror
	}: { disabled: boolean; examining: boolean; shown: string | null; onsubmit: (i: ModelInput) => void; onerror: (r: string) => void } = $props();

	let upload: HTMLInputElement;
	let bars = $state<number[]>([]);
	let recording = $state(false);
	let recorder: MediaRecorder | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let owned: string | null = null;

	$effect(() => {
		const url = shown;
		let gone = false;
		if (!url) { bars = []; return; }
		waveform(url).then((b) => { if (!gone) bars = b; }).catch(() => { if (!gone) bars = []; });
		return () => { gone = true; };
	});

	async function use(blob: Blob) {
		const url = URL.createObjectURL(blob);
		try {
			await waveform(url);
		} catch {
			URL.revokeObjectURL(url);
			return onerror('Couldn’t read that audio. Try a WAV, MP3 or M4A file.');
		}
		if (owned) URL.revokeObjectURL(owned);
		owned = shown = url;
		onsubmit({ type: 'audio', blob });
	}

	function take(file: File | null | undefined) {
		if (!file) return;
		const check = checkFile(file, 'audio');
		if (!check.ok) return onerror(check.reason);
		use(file);
	}

	async function toggleRecord() {
		if (recording) { recorder?.stop(); return; }
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
			return onerror('Recording isn’t supported in this browser. Upload a file instead.');
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (err) {
			return onerror(micErrorMessage((err as DOMException).name));
		}
		const chunks: Blob[] = [];
		const r = new MediaRecorder(stream);
		recorder = r;
		r.ondataavailable = (e) => chunks.push(e.data);
		r.onstop = () => {
			clearTimeout(timer);
			stream.getTracks().forEach((t) => t.stop());
			recording = false;
			use(new Blob(chunks, { type: r.mimeType || 'audio/webm' }));
		};
		r.start();
		recording = true;
		timer = setTimeout(() => r.state === 'recording' && r.stop(), MAX_RECORD_SECONDS * 1000);
	}

	$effect(() => () => {
		clearTimeout(timer);
		if (recorder?.state === 'recording') recorder.stop();
		if (owned) URL.revokeObjectURL(owned);
	});
</script>

<div class="audio">
	<div class="wave" aria-hidden="true">
		{#each bars as b, i (i)}<i style="transform: scaleY({Math.max(0.04, b)})"></i>{/each}
		{#if !bars.length}<p class="soft">{disabled ? 'Demo opens when this model is measured' : 'Record up to 15 seconds, or upload a clip'}</p>{/if}
		{#if examining}<span class="playhead"></span>{/if}
	</div>
	{#if shown}<audio controls src={shown}></audio>{/if}
	<div class="actions">
		<button class="btn" {disabled} aria-pressed={recording} onclick={toggleRecord}>{recording ? '■ Stop' : '● Record'}</button>
		<button class="btn ghost" {disabled} onclick={() => upload.click()}>Upload</button>
		<input bind:this={upload} type="file" accept="audio/*" hidden onchange={(e) => take(e.currentTarget.files?.[0])} />
	</div>
</div>

<style>
	.audio { display: grid; gap: var(--space-2); }
	.wave {
		position: relative; overflow: hidden; height: 96px; display: flex; align-items: center; gap: 2px;
		padding: 0 var(--space-1); background: var(--plate); border: 1px solid var(--hairline);
	}
	.wave i { flex: 1; height: 100%; background: var(--ink); transform-origin: center; border-radius: 1px; }
	.wave p { margin: auto; }
	audio { width: 100%; }
	.actions { display: flex; gap: var(--space-1); flex-wrap: wrap; }
	.actions .btn { flex: 1 1 8rem; }
</style>
