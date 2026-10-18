export const LOOP_FPS = 30;
export const LOOP_FRAMES = 150; // 5 s by default; every loop's motion is periodic in its own length, so it repeats seamlessly

/** One size per banner layout on the deck (src/lib/components/present/Banner.svelte). */
export const loopSize = {
	strip: { width: 480, height: 1080 },
	slant: { width: 1000, height: 1080 },
	monitor: { width: 1280, height: 800 },
	band: { width: 1920, height: 280 }
} as const;

export type LoopLayout = keyof typeof loopSize;

/** In slide order; ids match `loop` in src/lib/present/slides.ts (tested). */
/** `frames` / `size` override the defaults (slower loops run longer; slide 5 also sits in a narrower slant). */
export const loops: readonly { id: string; layout: LoopLayout; frames?: number; size?: { width: number; height: number } }[] = [
	{ id: 'swarm', layout: 'slant' },
	{ id: 'boxes', layout: 'monitor' },
	{ id: 'pipeline', layout: 'band', frames: 360 },
	{ id: 'device', layout: 'strip' },
	{ id: 'sea', layout: 'slant', frames: 540, size: { width: 850, height: 1080 } },
	{ id: 'sound', layout: 'strip' },
	{ id: 'rag', layout: 'band', frames: 300 },
	{ id: 'coming', layout: 'slant' },
	{ id: 'site', layout: 'monitor' }
];

export const framesOf = (l: (typeof loops)[number]) => l.frames ?? LOOP_FRAMES;
export const sizeOf = (l: (typeof loops)[number]) => l.size ?? loopSize[l.layout];
