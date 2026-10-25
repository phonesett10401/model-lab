/** A rectangle in page pixels. */
export interface Box { x: number; y: number; w: number; h: number }

export type RegionClass = 'bubble' | 'caption' | 'sfx' | 'art-text';
export type Speaker = 'man' | 'woman' | 'child' | 'narrator' | 'unknown';

/** One numbered English line sent for translation. Text only: never image data. */
export interface SentLine { n: number; text: string; cls: RegionClass; speaker: Speaker }
/** english: the English as Gemini read it (OCR slips fixed), when it returns one. */
export interface GotLine { n: number; text: string; english?: string }

export type TranslateReply =
	| { ok: true; lines: GotLine[]; model: string }
	| { ok: false; error: 'bad-request' | 'forbidden' | 'quota' | 'busy' | 'upstream' | 'blocked' };

export type LineProblem = 'missing' | 'not-burmese' | 'zawgyi' | 'length' | 'unread' | 'blocked';

/** One text area the visitor marked on a page. */
export interface Region {
	id: number; box: Box; cls: RegionClass; speaker: Speaker;
	english: string; burmese: string; problem: LineProblem | null;
	/** What the OCR read (empty for hand-drawn boxes), and whether the visitor typed in the English field. */
	ocr: string; edited: boolean;
}

/** `fallback` takes over when `model`'s free daily quota is used up. */
export interface ServerEnv { key: string; model: string; fallback?: string; tier: 'free' | 'paid' }
