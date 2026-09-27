export const FPS = 30;
export const DURATION = 450;

/**
 * The music bed: "Tech Circuit Data Stream" (Alex Morgan, Pixabay licence).
 * The track's big drop is at 22.1 s; starting the excerpt at 12.6 s puts it on the WRONG stamp (9.5 s),
 * and every cut below sits on its 105 BPM beat grid (one beat ≈ 17.14 frames).
 */
export const MUSIC = {
	file: 'music.mp3',
	bpm: 105,
	trackSeconds: 83.28,
	dropInTrackSeconds: 22.1,
	dropFrame: 285,
	get startSeconds() {
		return this.dropInTrackSeconds - this.dropFrame / FPS;
	}
};

export type BeatId = 'title' | 'fly' | 'open' | 'right' | 'wrong' | 'report' | 'end';

export const beats: { id: BeatId; from: number; duration: number }[] = [
	{ id: 'title', from: 0, duration: 62 },
	{ id: 'fly', from: 62, duration: 103 },
	{ id: 'open', from: 165, duration: 34 },
	{ id: 'right', from: 199, duration: 52 },
	{ id: 'wrong', from: 251, duration: 85 },
	{ id: 'report', from: 336, duration: 69 },
	{ id: 'end', from: 405, duration: 45 }
];

export const beat = (id: BeatId) => beats.find((b) => b.id === id)!;

/** Frame (within the wrong beat) where the WRONG stamp lands: on the drop. */
export const STAMP_AT = MUSIC.dropFrame - 251;
/** Frame (within the right beat) where the bars start, and where the answer appears. */
export const BARS_AT = 16;
export const ANSWER_AT = 36;
/** Frames (within the report beat) where each card lands, then the stamp. */
export const COLUMNS_AT = [6, 14, 22];
export const RECORDED_AT = 40;

export type Sfx = 'pad' | 'tick' | 'whoosh' | 'brake' | 'clunk' | 'scan' | 'ding' | 'thud' | 'paper' | 'chord';
export type Cue = { sfx: Sfx; at: number; volume: number; rate?: number };

const beatFrames = (FPS * 60) / MUSIC.bpm;
const right = beat('right').from;
const report = beat('report').from;

// Sound effects sit on top of the music, quieter than before.
export const cues: Cue[] = [
	// a whoosh per beat as the rows accelerate
	...Array.from({ length: 6 }, (_, i) => ({ sfx: 'whoosh' as const, at: Math.round(beat('fly').from + i * beatFrames), volume: 0.4, rate: 1 + i * 0.12 })),
	{ sfx: 'brake', at: beat('open').from, volume: 0.4 },
	{ sfx: 'clunk', at: beat('open').from + 12, volume: 0.55 },
	{ sfx: 'scan', at: right + 3, volume: 0.2 },
	...Array.from({ length: 6 }, (_, i) => ({ sfx: 'tick' as const, at: right + BARS_AT + i * 3, volume: 0.25, rate: 1 + i * 0.1 })),
	{ sfx: 'ding', at: right + ANSWER_AT, volume: 0.4 },
	{ sfx: 'thud', at: MUSIC.dropFrame, volume: 0.8 },
	...COLUMNS_AT.map((f) => ({ sfx: 'paper' as const, at: report + f, volume: 0.45 }))
];

/** Music level: quick fade in, a short duck so the thud cuts through, fade out over the last 20 frames. */
export function musicVolume(frame: number): number {
	const base = 0.68; // the track is mastered loud; keeps the mix's peak ~2 dB below full scale
	if (frame < 12) return base * (frame / 12);
	if (frame >= MUSIC.dropFrame && frame < MUSIC.dropFrame + 12) return 0.5;
	if (frame >= DURATION - 20) return base * Math.max(0, (DURATION - frame) / 20);
	return base;
}
