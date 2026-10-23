export type RegionClass = 'bubble' | 'caption' | 'sfx' | 'art-text';
export type Speaker = 'man' | 'woman' | 'child' | 'narrator' | 'unknown';

/** One numbered English line sent for translation. Text only: never image data. */
export interface SentLine { n: number; text: string; cls: RegionClass; speaker: Speaker }
export interface GotLine { n: number; text: string }

export type TranslateReply =
	| { ok: true; lines: GotLine[]; model: string }
	| { ok: false; error: 'bad-request' | 'forbidden' | 'quota' | 'upstream' };

export type LineProblem = 'missing' | 'not-burmese' | 'zawgyi' | 'length';

export interface ServerEnv { key: string; model: string; tier: 'free' | 'paid' }
