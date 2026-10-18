declare global {
	const __SHOW_DRAFTS__: boolean;
	/** The production site's origin (or localhost in local builds); the deck's QR points here. */
	const __SITE_ORIGIN__: string;
	namespace App {}
}

export {};
