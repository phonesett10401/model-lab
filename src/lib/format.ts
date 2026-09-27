import type { Entry } from './types';

export const pad = (n: number) => String(n).padStart(2, '0');
export const pct = (score: number) => Math.round(score * 100);
export const kindLabel = (e: Entry) => (e.kind === 'audit' ? 'AUDIT' : e.input.toUpperCase());
export const entryPath = (e: Entry) => `/${e.kind === 'model' ? 'models' : 'audits'}/${e.slug}`;
