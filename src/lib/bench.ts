import { isUnsure, topN } from './predictions';
import type { Prediction } from './types';

type Last = Prediction[] | null;

export type BenchState =
	| { kind: 'ready'; last: Last }
	| { kind: 'loading'; progress: number | null; last: Last }
	| { kind: 'examining'; last: Last }
	| { kind: 'result'; predictions: Prediction[]; unsure: boolean }
	| { kind: 'error'; reason: string; last: Last };

export type BenchEvent =
	| { type: 'load' }
	| { type: 'progress'; value: number | null }
	| { type: 'examine' }
	| { type: 'done'; predictions: Prediction[]; threshold: number; detect?: boolean }
	| { type: 'fail'; reason: string }
	| { type: 'reset' };

export const initialBench: BenchState = { kind: 'ready', last: null };

export const lastResult = (s: BenchState): Last => (s.kind === 'result' ? s.predictions : s.last);

export function step(s: BenchState, e: BenchEvent): BenchState {
	switch (e.type) {
		case 'load':
			return { kind: 'loading', progress: null, last: lastResult(s) };
		case 'progress':
			return s.kind === 'loading' ? { ...s, progress: e.value } : s;
		case 'examine':
			return { kind: 'examining', last: lastResult(s) };
		case 'done': {
			if (e.detect) {
				// A detector reports everything it found above the threshold; nothing found is the "unsure" state.
				const predictions = e.predictions.filter((p) => p.score >= e.threshold).sort((a, b) => b.score - a.score);
				return { kind: 'result', predictions, unsure: predictions.length === 0 };
			}
			const predictions = topN(e.predictions);
			return { kind: 'result', predictions, unsure: isUnsure(predictions, e.threshold) };
		}
		case 'fail':
			return { kind: 'error', reason: e.reason, last: lastResult(s) };
		case 'reset':
			return initialBench;
	}
}
