export type Layout = 'wide' | 'square' | 'tall';

export const sizes: Record<Layout, { width: number; height: number }> = {
	wide: { width: 1920, height: 1080 },
	square: { width: 1080, height: 1080 },
	tall: { width: 1080, height: 1920 }
};

/** 1 when the short side is 1080px. Everything is sized in units, so all layouts share one design. */
export const unit = (l: Layout) => Math.min(sizes[l].width, sizes[l].height) / 1080;

/** Tall stacks the photo above the bars; wide and square put them side by side. */
export const stacked = (l: Layout) => sizes[l].height > sizes[l].width;
