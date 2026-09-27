export const FPS = 30;
export const DURATION = 600;

/**
 * The music bed: "Tech Circuit Data Stream" (Alex Morgan, Pixabay licence).
 * The track's big drop is at 22.1 s; starting the excerpt at 7.6 s puts it on the WRONG stamp (14.5 s),
 * and every cut below sits on its 105 BPM beat grid (one beat ≈ 17.14 frames).
 */
export const MUSIC = {
	file: 'music.mp3',
	bpm: 105,
	trackSeconds: 83.28,
	dropInTrackSeconds: 22.1,
	dropFrame: 435,
	get startSeconds() {
		return this.dropInTrackSeconds - this.dropFrame / FPS;
	}
};

export const BEAT_FRAMES = (FPS * 60) / MUSIC.bpm;

export type BeatId = 'title' | 'fly' | 'focus' | 'expand' | 'upload' | 'result' | 'wrong' | 'report' | 'end';

export const beats: { id: BeatId; from: number; duration: number }[] = [
	{ id: 'title', from: 0, duration: 75 },
	{ id: 'fly', from: 75, duration: 103 },
	{ id: 'focus', from: 178, duration: 68 },
	{ id: 'expand', from: 246, duration: 35 },
	{ id: 'upload', from: 281, duration: 68 },
	{ id: 'result', from: 349, duration: 69 },
	{ id: 'wrong', from: 418, duration: 86 },
	{ id: 'report', from: 504, duration: 51 },
	{ id: 'end', from: 555, duration: 45 }
];

export const beat = (id: BeatId) => beats.find((b) => b.id === id)!;

/** Frame (within the wrong beat) where the WRONG stamp lands: on the drop. */
export const STAMP_AT = MUSIC.dropFrame - beat('wrong').from;
/** Upload beat: when the photo lands and when the progress ring completes. */
export const DROP_AT = 14;
export const UPLOADED_AT = 50;
/** Result beat: when the bars start and when the answer finishes typing. */
export const BARS_AT = 24;
export const ANSWER_AT = 44;
/** Report beat: when each card lands, then the stamp. */
export const COLUMNS_AT = [4, 10, 16];
export const RECORDED_AT = 30;

/** 1 on each music beat, decaying to ~0 before the next: drives the glow pulses. */
export function beatPulse(frame: number): number {
	const since = (((frame - MUSIC.dropFrame) % BEAT_FRAMES) + BEAT_FRAMES) % BEAT_FRAMES;
	return Math.exp(-since / 4);
}

export type Sfx = 'pad' | 'tick' | 'whoosh' | 'brake' | 'clunk' | 'scan' | 'ding' | 'thud' | 'paper' | 'chord';
export type Cue = { sfx: Sfx; at: number; volume: number; rate?: number };

const upload = beat('upload').from;
const result = beat('result').from;
const report = beat('report').from;

// Sound effects sit on top of the music.
export const cues: Cue[] = [
	...Array.from({ length: 6 }, (_, i) => ({ sfx: 'whoosh' as const, at: Math.round(beat('fly').from + i * BEAT_FRAMES), volume: 0.35, rate: 1 + i * 0.12 })),
	{ sfx: 'brake', at: beat('focus').from, volume: 0.35 },
	{ sfx: 'chord', at: beat('focus').from + 10, volume: 0.25 },
	{ sfx: 'clunk', at: beat('expand').from + 10, volume: 0.5 },
	{ sfx: 'clunk', at: upload + DROP_AT, volume: 0.35, rate: 1.3 },
	...Array.from({ length: 5 }, (_, i) => ({ sfx: 'tick' as const, at: upload + DROP_AT + 6 + i * 6, volume: 0.2, rate: 1 + i * 0.08 })),
	{ sfx: 'ding', at: upload + UPLOADED_AT, volume: 0.3, rate: 1.5 },
	{ sfx: 'scan', at: result + 2, volume: 0.2 },
	...Array.from({ length: 6 }, (_, i) => ({ sfx: 'tick' as const, at: result + BARS_AT + i * 3, volume: 0.22, rate: 1 + i * 0.1 })),
	{ sfx: 'ding', at: result + ANSWER_AT, volume: 0.4 },
	{ sfx: 'thud', at: MUSIC.dropFrame, volume: 0.8 },
	...COLUMNS_AT.map((f) => ({ sfx: 'paper' as const, at: report + f, volume: 0.4 }))
];

/** Music level: quick fade in, a short duck so the thud cuts through, fade out over the last 24 frames. */
export function musicVolume(frame: number): number {
	const base = 0.68; // the track is mastered loud; keeps the mix's peak ~2 dB below full scale
	if (frame < 12) return base * (frame / 12);
	if (frame >= MUSIC.dropFrame && frame < MUSIC.dropFrame + 12) return 0.45;
	if (frame >= DURATION - 24) return base * Math.max(0, (DURATION - frame) / 24);
	return base;
}
