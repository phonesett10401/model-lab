/** A rectangle in page pixels. */
export interface Box { x: number; y: number; w: number; h: number }

export type RegionClass = 'bubble' | 'caption' | 'sfx' | 'art-text';
export type Speaker = 'man' | 'woman' | 'child' | 'narrator' | 'unknown';

/** One numbered English line sent for translation. Text only: never image data. */
export interface SentLine { n: number; text: string; cls: RegionClass; speaker: Speaker }
export interface GotLine { n: number; text: string }

export type TranslateReply =
	| { ok: true; lines: GotLine[]; model: string }
	| { ok: false; error: 'bad-request' | 'forbidden' | 'quota' | 'upstream' };

export type LineProblem = 'missing' | 'not-burmese' | 'zawgyi' | 'length';

/** One text area the visitor marked on a page. */
export interface Region {
	id: number; box: Box; cls: RegionClass; speaker: Speaker;
	english: string; burmese: string; problem: LineProblem | null;
}

export interface ServerEnv { key: string; model: string; tier: 'free' | 'paid' }
