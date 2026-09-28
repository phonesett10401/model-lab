export const SR = 32000;
export const WIN = SR;
export const STEP = SR / 2;
export const MAX_SECONDS = 30;
export const MIN_SECONDS = 0.5;

/** Start sample of every 1 s slice (same rule as training/sounds_common.py window_starts). */
export function windowStarts(n: number): number[] {
	const count = n <= WIN ? 1 : Math.ceil((n - WIN) / STEP) + 1;
	return Array.from({ length: count }, (_, i) => i * STEP);
}

/** All slices of a clip in one [count × WIN] batch; the last one is zero-padded. */
export function slices(x: Float32Array): { data: Float32Array; count: number } {
	const starts = windowStarts(x.length);
	const data = new Float32Array(starts.length * WIN);
	starts.forEach((s, i) => data.set(x.subarray(s, Math.min(x.length, s + WIN)), i * WIN));
	return { data, count: starts.length };
}
