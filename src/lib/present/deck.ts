export type Action = 'next' | 'prev' | 'first' | 'last' | 'fullscreen' | null;

const keys: Record<string, Action> = {
	' ': 'next', ArrowDown: 'next', ArrowRight: 'next', PageDown: 'next', // PageUp/PageDown are what presentation clickers send
	ArrowUp: 'prev', ArrowLeft: 'prev', PageUp: 'prev',
	Home: 'first', End: 'last', f: 'fullscreen', F: 'fullscreen'
};

export const keyAction = (key: string): Action => keys[key] ?? null;

/** Index 0 is the intro video, 1..count are slides. Back from slide 1 does not reopen the intro. */
export function step(index: number, action: Action, count: number): number {
	if (action === 'next') return Math.min(index + 1, count);
	if (action === 'prev') return index <= 1 ? index : index - 1;
	if (action === 'first') return 1;
	if (action === 'last') return count;
	return index;
}

export function indexFromHash(hash: string, count: number): number | null {
	const m = /^#(\d+)$/.exec(hash);
	const n = m ? Number(m[1]) : 0;
	return n >= 1 && n <= count ? n : null;
}

export const hashFor = (index: number) => `#${index}`;
