export const LOOP_FPS = 30;
export const LOOP_FRAMES = 150; // 5 s; every loop's motion is periodic in frame / LOOP_FRAMES, so it repeats seamlessly

/** One size per banner layout on the deck (src/lib/components/present/Banner.svelte). */
export const loopSize = {
	strip: { width: 480, height: 1080 },
	slant: { width: 1000, height: 1080 },
	monitor: { width: 1280, height: 800 },
	band: { width: 1920, height: 280 }
} as const;

export type LoopLayout = keyof typeof loopSize;

/** In slide order; ids match `loop` in src/lib/present/slides.ts (tested). */
export const loops: readonly { id: string; layout: LoopLayout }[] = [
	{ id: 'swarm', layout: 'slant' },
	{ id: 'boxes', layout: 'monitor' },
	{ id: 'pipeline', layout: 'band' },
	{ id: 'device', layout: 'strip' },
	{ id: 'sea', layout: 'slant' },
	{ id: 'sound', layout: 'strip' },
	{ id: 'rag', layout: 'band' },
	{ id: 'coming', layout: 'slant' },
	{ id: 'site', layout: 'monitor' }
];
