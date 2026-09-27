import type { Entry } from './types';

export const pad = (n: number) => String(n).padStart(2, '0');
export const pct = (score: number) => Math.round(score * 100);
/** The number a springing bar shows: never above the true score, never below 0. */
export const shownPct = (current: number, target: number) => pct(Math.max(0, Math.min(current, target)));
export const kindLabel = (e: Entry) => (e.kind === 'audit' ? 'AUDIT' : e.input.toUpperCase());
export const entryPath = (e: Entry) => `/${e.kind === 'model' ? 'models' : 'audits'}/${e.slug}`;
