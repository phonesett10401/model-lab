export const FPS = 30;
export const DURATION = 450;

export type BeatId = 'title' | 'fly' | 'open' | 'right' | 'wrong' | 'report' | 'end';

export const beats: { id: BeatId; from: number; duration: number }[] = [
	{ id: 'title', from: 0, duration: 45 },
	{ id: 'fly', from: 45, duration: 90 },
	{ id: 'open', from: 135, duration: 30 },
	{ id: 'right', from: 165, duration: 90 },
	{ id: 'wrong', from: 255, duration: 75 },
	{ id: 'report', from: 330, duration: 75 },
	{ id: 'end', from: 405, duration: 45 }
];

export const beat = (id: BeatId) => beats.find((b) => b.id === id)!;

/** Frame (within the wrong beat) where the WRONG stamp lands. */
export const STAMP_AT = 30;
/** Frame (within the right beat) where the answer appears. */
export const ANSWER_AT = 57;
/** Frames (within the report beat) where each column lands, then the stamp. */
export const COLUMNS_AT = [8, 18, 28];
export const RECORDED_AT = 50;

export type Sfx = 'pad' | 'tick' | 'whoosh' | 'brake' | 'clunk' | 'scan' | 'ding' | 'thud' | 'paper' | 'chord';
export type Cue = { sfx: Sfx; at: number; volume: number; rate?: number };

const title = 'AI MODEL LAB';
const right = beat('right').from;
const report = beat('report').from;

export const cues: Cue[] = [
	// one tick per letter as the name types in (a letter every 2.5 frames)
	...Array.from(title, (_, i) => ({ sfx: 'tick' as const, at: Math.round(i * 2.5), volume: 0.5 })),
	// a whoosh per row pass, pitch rising with the speed
	...Array.from({ length: 6 }, (_, i) => ({ sfx: 'whoosh' as const, at: beat('fly').from + i * 15, volume: 0.6, rate: 1 + i * 0.12 })),
	{ sfx: 'brake', at: beat('open').from, volume: 0.6 },
	{ sfx: 'clunk', at: beat('open').from + 15, volume: 0.8 },
	{ sfx: 'scan', at: right + 5, volume: 0.3 },
	...Array.from({ length: 6 }, (_, i) => ({ sfx: 'tick' as const, at: right + 35 + i * 3, volume: 0.35, rate: 1 + i * 0.1 })),
	{ sfx: 'ding', at: right + ANSWER_AT, volume: 0.6 },
	{ sfx: 'thud', at: beat('wrong').from + STAMP_AT, volume: 0.9 },
	...COLUMNS_AT.map((f) => ({ sfx: 'paper' as const, at: report + f, volume: 0.6 })),
	{ sfx: 'chord', at: beat('end').from, volume: 0.55 }
];

/** The ambient pad: steady, dips to near silence before the stamp, fades out over the last 20 frames. */
export function padVolume(frame: number): number {
	const base = 0.35;
	const stamp = beat('wrong').from + STAMP_AT;
	if (frame >= stamp - 23 && frame < stamp) return 0.05;
	if (frame >= DURATION - 20) return base * Math.max(0, (DURATION - frame) / 20);
	return base;
}
