import type { ModelEntry, ModelInput, Prediction } from '$lib/types';
import { demoRuntime } from './demo';

/** An error whose message is meant for the visitor (anything else shows the generic "failed to run"). */
export class UserError extends Error {}

export interface ClipInfo {
	seconds: number;
	trimmed: boolean;
	peaks: number[];
}

export interface Runtime {
	/** Shown in the loading state, e.g. "23 MB". */
	sizeLabel: string;
	load(onProgress: (p: number | null) => void): Promise<void>;
	classify(input: ModelInput): Promise<Prediction[]>;
	/** Sound models: the clip the last result describes (length, whether it was cut, waveform). */
	lastClip?: ClipInfo | null;
	/** Sound models: per-sound thresholds and labels, and scoring for live listening. */
	thresholds?: number[];
	labels?: string[];
	scoreSlices?(data: Float32Array, count: number): Promise<Float32Array>;
}

/** Real models register here: slug → lazy import of their runtime. */
export const registry: Record<string, () => Promise<Runtime>> = {
	'sea-creature-detector': () => import('./sea-detector').then((m) => m.seaDetector()),
	'sound-detective': () => import('./sound-detective').then((m) => m.soundDetective())
};

export async function getRuntime(entry: ModelEntry): Promise<Runtime | null> {
	if (entry.status !== 'live') return null;
	const real = registry[entry.slug];
	if (real) return real();
	if (entry.draft) return demoRuntime(entry);
	return null;
}
