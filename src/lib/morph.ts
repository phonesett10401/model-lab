import type { OnNavigate } from '@sveltejs/kit';

/**
 * Morphs the title between states with the View Transitions API:
 * plate title → bench title when selecting on the archive, bench/page title → page/bench title across pages.
 * Only one element may carry a given view-transition-name per snapshot, so the plate borrows the name for
 * the "old" snapshot and gives it back before the "new" one is taken.
 */
export function startMorph(nav: OnNavigate): Promise<void> | void {
	if (!document.startViewTransition) return;
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const samePage = nav.from?.url.pathname === nav.to?.url.pathname;
	if (samePage && matchMedia('(max-width: 639px)').matches) return; // the phone sheet has its own motion

	const to = nav.to?.url.searchParams.get('entry');
	const plate = samePage && to ? document.querySelector<HTMLElement>(`[data-plate-title="${CSS.escape(to)}"]`) : null;
	const bench = document.querySelector<HTMLElement>('[data-bench-title]');
	if (samePage && !plate) return;

	if (plate) {
		plate.style.viewTransitionName = 'entry-title';
		bench?.style.setProperty('view-transition-name', 'none');
	}

	return new Promise((resolve) => {
		document.startViewTransition(async () => {
			resolve();
			await nav.complete;
			if (plate) plate.style.removeProperty('view-transition-name');
			document.querySelector<HTMLElement>('[data-bench-title]')?.style.removeProperty('view-transition-name');
		});
	});
}
