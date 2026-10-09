import { CHAT_MODEL, EMBED_MODEL, CONTEXT_WINDOW, MAX_REPLY_TOKENS, TEMPERATURE } from './config';
import type { ChatMessage } from './rag';

/** What the page needs from a model engine. e2e tests swap in a fake (window.__assistantEngine). */
export interface AssistantEngine {
	/** progress is 0–1 over both downloads; text is WebLLM's own status line. */
	load(onProgress: (progress: number, text: string) => void): Promise<void>;
	embed(texts: string[]): Promise<number[][]>;
	chat(messages: ChatMessage[]): Promise<string>;
}

export const NO_GPU = 'This assistant needs Chrome or Edge with graphics acceleration.';
export const OUT_OF_MEMORY = 'Your graphics card ran out of memory. Close other tabs and apps, then try again.';
export const LOAD_FAILED = 'The assistant didn’t finish loading. Check your connection and try again.';
export const ANSWER_FAILED = 'The assistant couldn’t answer. Try again.';

export type GpuLike = { requestAdapter(): Promise<{ features: { has(name: string): boolean } } | null> } | undefined;

/** null if this browser can run the model, else the message to show. The q4f16 model needs 16-bit shaders. */
export async function checkGpu(gpu: GpuLike): Promise<string | null> {
	try {
		const adapter = await gpu?.requestAdapter();
		return adapter?.features.has('shader-f16') ? null : NO_GPU;
	} catch {
		return NO_GPU;
	}
}

// ponytail: a lost device is usually memory; WebLLM gives no finer signal
export function explainError(e: unknown, fallback = LOAD_FAILED): string {
	const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
	return /out ?of ?memory|\bOOM\b|device ?lost/i.test(text) ? OUT_OF_MEMORY : fallback;
}

const EMBED_SHARE = 0.1; // ponytail: rough share of the download (search model ~0.1 GB of ~1 GB); only steers the bar

export function webllmEngine(): AssistantEngine {
	type Engine = import('@mlc-ai/web-llm').MLCEngineInterface;
	let embedder: Engine | undefined;
	let chatter: Engine | undefined;
	return {
		async load(onProgress) {
			const { CreateMLCEngine } = await import('@mlc-ai/web-llm'); // only on /assistant, only after Start
			// A failed try leaves the engine unset, so Try again resumes (finished files stay in the browser cache).
			embedder ??= await CreateMLCEngine(EMBED_MODEL, { initProgressCallback: (r) => onProgress(r.progress * EMBED_SHARE, r.text) });
			chatter ??= await CreateMLCEngine(CHAT_MODEL, { initProgressCallback: (r) => onProgress(EMBED_SHARE + r.progress * (1 - EMBED_SHARE), r.text) }, { context_window_size: CONTEXT_WINDOW });
		},
		async embed(texts) {
			const res = await embedder!.embeddings.create({ input: texts, model: EMBED_MODEL });
			return [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
		},
		async chat(messages) {
			const res = await chatter!.chat.completions.create({ messages, temperature: TEMPERATURE, max_tokens: MAX_REPLY_TOKENS });
			return res.choices[0]?.message.content ?? '';
		}
	};
}
