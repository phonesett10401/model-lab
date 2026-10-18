/** Eased count from 0 to value as t goes 0 → 1; clamped, so the shown number never passes the measured one. */
export function countup(value: number, t: number): number {
	const k = Math.min(Math.max(t, 0), 1);
	return k === 1 ? value : value * (1 - (1 - k) ** 3);
}
