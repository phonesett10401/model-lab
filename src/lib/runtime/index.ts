import type { ModelEntry, ModelInput, Prediction } from '$lib/types';
import { demoRuntime } from './demo';

export interface Runtime {
	/** Shown in the loading state, e.g. "23 MB". */
	sizeLabel: string;
	load(onProgress: (p: number | null) => void): Promise<void>;
	classify(input: ModelInput): Promise<Prediction[]>;
}

/** Real models register here: slug → lazy import of their runtime. */
export const registry: Record<string, () => Promise<Runtime>> = {
	'sea-creature-detector': () => import('./sea-detector').then((m) => m.seaDetector())
};

export async function getRuntime(entry: ModelEntry): Promise<Runtime | null> {
	if (entry.status !== 'live') return null;
	const real = registry[entry.slug];
	if (real) return real();
	if (entry.draft) return demoRuntime(entry);
	return null;
}
